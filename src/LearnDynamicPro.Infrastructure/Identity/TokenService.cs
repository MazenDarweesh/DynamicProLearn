using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Entities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LearnDynamicPro.Infrastructure.Identity;

public class TokenService : ITokenService
{
    private readonly JwtSettings _jwtSettings;
    private readonly ErpSsoSettings _erpSsoSettings;
    private readonly IMemoryCache _memoryCache;
    private readonly object _jtiLock = new();

    public TokenService(
        IOptions<JwtSettings> jwtSettings,
        IOptions<ErpSsoSettings> erpSsoSettings,
        IMemoryCache memoryCache)
    {
        _jwtSettings = jwtSettings.Value;
        _erpSsoSettings = erpSsoSettings.Value;
        _memoryCache = memoryCache;
    }

    public bool IsLegacyErpLoginAllowed => _erpSsoSettings.AllowLegacyErpLogin;

    public string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim("Id", user.Id.ToString()),
            new Claim("user_id", user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username ?? ""),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("Role", user.Role.ToString()),
            new Claim("role", user.Role.ToString())
        };

        AddTenantClaims(claims, user.CompanyId, user.DepartmentId);

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_jwtSettings.ExpiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim("Id", user.Id.ToString()),
            new Claim("token_type", "refresh"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7), // 7 days valid
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = false,
            ValidateIssuer = false,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret)),
            ValidateLifetime = false
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);
            if (securityToken is not JwtSecurityToken jwtSecurityToken ||
                !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return null;
            }

            return principal;
        }
        catch
        {
            return null;
        }
    }

    public bool ValidateRefreshToken(string refreshToken, out Guid userId)
    {
        userId = Guid.Empty;
        var principal = ValidateSignedToken(
            refreshToken,
            expectedTokenType: "refresh",
            secret: _jwtSettings.Secret,
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            clockSkew: TimeSpan.FromMinutes(1),
            out _);
        if (principal is null) return false;

        var sub = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                  ?? principal.FindFirst("Id")?.Value;

        return Guid.TryParse(sub, out userId);
    }

    public bool ValidateErpSsoToken(string ssoToken, out string username)
    {
        username = string.Empty;
        if (string.IsNullOrWhiteSpace(_erpSsoSettings.Secret) || _erpSsoSettings.Secret.Length < 32)
            return false;

        var principal = ValidateSignedToken(
            ssoToken,
            expectedTokenType: "erp_sso",
            secret: _erpSsoSettings.Secret,
            issuer: _erpSsoSettings.Issuer,
            audience: _erpSsoSettings.Audience,
            clockSkew: TimeSpan.FromSeconds(30),
            out var securityToken);
        if (principal is null || securityToken is null) return false;

        var maxAllowedExpiry = DateTime.UtcNow.AddMinutes(Math.Max(1, _erpSsoSettings.MaxTokenLifetimeMinutes) + 1);
        if (securityToken.ValidTo > maxAllowedExpiry)
            return false;

        var jti = principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;
        if (string.IsNullOrWhiteSpace(jti))
            return false;

        var cacheKey = $"erp_sso_jti:{jti}";
        lock (_jtiLock)
        {
            if (_memoryCache.TryGetValue(cacheKey, out _))
                return false;

            var expiryOffset = new DateTimeOffset(DateTime.SpecifyKind(securityToken.ValidTo, DateTimeKind.Utc)).AddMinutes(1);
            _memoryCache.Set(cacheKey, true, expiryOffset);
        }

        var resolved = principal.FindFirst(JwtRegisteredClaimNames.UniqueName)?.Value
                       ?? principal.FindFirst(ClaimTypes.Name)?.Value
                       ?? principal.FindFirst("username")?.Value
                       ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

        if (string.IsNullOrWhiteSpace(resolved)) return false;

        username = resolved.Trim();
        return true;
    }

    private static ClaimsPrincipal? ValidateSignedToken(
        string token,
        string expectedTokenType,
        string secret,
        string? issuer,
        string? audience,
        TimeSpan clockSkew,
        out SecurityToken? validatedToken)
    {
        validatedToken = null;
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(secret)) return null;

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = !string.IsNullOrEmpty(audience),
            ValidAudience = audience,
            ValidateIssuer = !string.IsNullOrEmpty(issuer),
            ValidIssuer = issuer,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = clockSkew
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);
            if (securityToken is not JwtSecurityToken jwtSecurityToken ||
                !jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
            {
                return null;
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            if (tokenType != expectedTokenType) return null;

            validatedToken = securityToken;
            return principal;
        }
        catch
        {
            return null;
        }
    }

    public string GenerateServiceCallToken(Guid userId, string role, Guid? companyId = null, Guid? departmentId = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim("Id", userId.ToString()),
            new Claim("user_id", userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, "system"),
            new Claim(ClaimTypes.Role, role),
            new Claim("Role", role),
            new Claim("role", role),
            new Claim("token_type", "service_call"),
        };

        AddTenantClaims(claims, companyId, departmentId);

        var token = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(5), // Short-lived for immediate backend-to-backend call
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static void AddTenantClaims(List<Claim> claims, Guid? companyId, Guid? departmentId)
    {
        if (companyId.HasValue && companyId.Value != Guid.Empty)
        {
            var companyStr = companyId.Value.ToString();
            claims.Add(new Claim("company_id", companyStr));
            claims.Add(new Claim("CompanyId", companyStr));
        }

        if (departmentId.HasValue && departmentId.Value != Guid.Empty)
        {
            var deptStr = departmentId.Value.ToString();
            claims.Add(new Claim("department_id", deptStr));
            claims.Add(new Claim("DepartmentId", deptStr));
        }
    }
}
