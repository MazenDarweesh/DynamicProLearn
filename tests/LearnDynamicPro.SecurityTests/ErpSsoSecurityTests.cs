using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LearnDynamicPro.Application.Dtos.Auth;
using LearnDynamicPro.Application.Features.Auth;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Infrastructure.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace LearnDynamicPro.SecurityTests;

public class ErpSsoSecurityTests
{
    private const string TestSsoSecret = "UnitTest_ErpSso_Dedicated_Secret_At_Least_32_Chars!";
    private const string TestJwtSecret = "UnitTest_Main_Jwt_Secret_At_Least_32_Chars_Long!";

    private static TokenService CreateTokenService(
        string? ssoSecret = TestSsoSecret,
        bool allowLegacyErpLogin = false,
        IMemoryCache? memoryCache = null)
    {
        var jwtOptions = Options.Create(new JwtSettings
        {
            Secret = TestJwtSecret,
            Issuer = "DynamicProLearn",
            Audience = "DynamicProLearnClient",
            ExpiryMinutes = 60
        });

        var ssoOptions = Options.Create(new ErpSsoSettings
        {
            Secret = ssoSecret ?? string.Empty,
            Issuer = "ERPSystemAPI",
            Audience = "DynamicProLearn",
            MaxTokenLifetimeMinutes = 5,
            AllowLegacyErpLogin = allowLegacyErpLogin
        });

        return new TokenService(jwtOptions, ssoOptions, memoryCache ?? new MemoryCache(new MemoryCacheOptions()));
    }

    private static string MintErpSsoToken(
        string secret = TestSsoSecret,
        string issuer = "ERPSystemAPI",
        string audience = "DynamicProLearn",
        string tokenType = "erp_sso",
        string? jti = null,
        string username = "ahmed.erp",
        DateTime? expiresUtc = null,
        DateTime? notBeforeUtc = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, username),
            new(JwtRegisteredClaimNames.UniqueName, username),
            new("token_type", tokenType)
        };

        if (jti is not null)
        {
            claims.Add(new Claim(JwtRegisteredClaimNames.Jti, jti));
        }

        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: notBeforeUtc ?? now.AddMinutes(-1),
            expires: expiresUtc ?? now.AddMinutes(3),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [Fact]
    public void ValidateErpSsoToken_ValidToken_SucceedsOnce_AndRejectsReplay()
    {
        var sut = CreateTokenService();
        var token = MintErpSsoToken(jti: Guid.NewGuid().ToString("N"), username: "mazen.erp");

        var firstResult = sut.ValidateErpSsoToken(token, out var username);
        var replayResult = sut.ValidateErpSsoToken(token, out var replayUsername);

        Assert.True(firstResult);
        Assert.Equal("mazen.erp", username);
        Assert.False(replayResult);
        Assert.Equal(string.Empty, replayUsername);
    }

    [Fact]
    public void ValidateErpSsoToken_ExpiredToken_IsRejected()
    {
        var sut = CreateTokenService();
        var expired = MintErpSsoToken(
            jti: Guid.NewGuid().ToString("N"),
            notBeforeUtc: DateTime.UtcNow.AddMinutes(-10),
            expiresUtc: DateTime.UtcNow.AddMinutes(-2));

        Assert.False(sut.ValidateErpSsoToken(expired, out _));
    }

    [Fact]
    public void ValidateErpSsoToken_WrongSecretOrTamperedToken_IsRejected()
    {
        var sut = CreateTokenService();
        var wrongSecretToken = MintErpSsoToken(
            secret: "Completely_Different_Secret_Key_At_Least_32_Chars!",
            jti: Guid.NewGuid().ToString("N"));

        var validToken = MintErpSsoToken(jti: Guid.NewGuid().ToString("N"));
        var parts = validToken.Split('.');
        var tamperedToken = $"{parts[0]}.{parts[1]}.tampered_signature";

        Assert.False(sut.ValidateErpSsoToken(wrongSecretToken, out _));
        Assert.False(sut.ValidateErpSsoToken(tamperedToken, out _));
    }

    [Theory]
    [InlineData("WrongIssuer", "DynamicProLearn", "erp_sso")]
    [InlineData("ERPSystemAPI", "WrongAudience", "erp_sso")]
    [InlineData("ERPSystemAPI", "DynamicProLearn", "refresh")]
    public void ValidateErpSsoToken_WrongIssuerAudienceOrType_IsRejected(
        string issuer,
        string audience,
        string tokenType)
    {
        var sut = CreateTokenService();
        var token = MintErpSsoToken(
            issuer: issuer,
            audience: audience,
            tokenType: tokenType,
            jti: Guid.NewGuid().ToString("N"));

        Assert.False(sut.ValidateErpSsoToken(token, out _));
    }

    [Fact]
    public void ValidateErpSsoToken_LifetimeExceedingMax_IsRejected()
    {
        var sut = CreateTokenService();
        var tooLongToken = MintErpSsoToken(
            jti: Guid.NewGuid().ToString("N"),
            expiresUtc: DateTime.UtcNow.AddMinutes(30));

        Assert.False(sut.ValidateErpSsoToken(tooLongToken, out _));
    }

    [Fact]
    public void ValidateErpSsoToken_MissingSsoSecret_IsRejected_DoesNotFallbackToMainJwtSecret()
    {
        var sut = CreateTokenService(ssoSecret: string.Empty);
        var tokenSignedWithMainJwtSecret = MintErpSsoToken(
            secret: TestJwtSecret,
            jti: Guid.NewGuid().ToString("N"));

        Assert.False(sut.ValidateErpSsoToken(tokenSignedWithMainJwtSecret, out _));
    }

    [Fact]
    public async Task AuthService_ErpLoginAsync_RejectsLegacyUsernamePassword_WhenFlagDisabled()
    {
        var tokenService = CreateTokenService(allowLegacyErpLogin: false);
        var authService = new AuthService(
            new StubUnitOfWork(),
            new StubPasswordHasher(),
            tokenService);

        var result = await authService.ErpLoginAsync(new ErpLoginRequest
        {
            Username = "legacy.user",
            Password = "legacy.password"
        });

        Assert.False(result.IsSuccess);
        Assert.Contains("disabled", result.Error ?? string.Empty, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class StubUnitOfWork : IUnitOfWork
    {
        public IGenericRepository<T> Repository<T>() where T : class =>
            throw new InvalidOperationException("Repository should not be queried when legacy login is disabled.");
        public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => Task.FromResult(0);
        public void Dispose() { }
    }

    private sealed class StubPasswordHasher : IPasswordHasher
    {
        public string Hash(string password) => password;
        public bool Verify(string password, string hash) => false;
    }
}
