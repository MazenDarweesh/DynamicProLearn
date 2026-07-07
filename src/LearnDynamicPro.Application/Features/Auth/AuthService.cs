using LearnDynamicPro.Application.Dtos.Auth;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Auth;

public class AuthService : IAuthService
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;

    public AuthService(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        ITokenService tokenService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<Result<LoginResponse>> LoginAsync(LoginRequest request)
    {
        // 1. Find user by username (case-insensitive)
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower());

        if (user is null)
            return Result<LoginResponse>.Failure(AppErrors.Authentication.InvalidCredentials);

        // 2. Verify password hash
        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
            return Result<LoginResponse>.Failure(AppErrors.Authentication.InvalidCredentials);

        // 3. Generate JWT token carrying all claims needed downstream
        var token = _tokenService.GenerateToken(user);

        var response = new LoginResponse
        {
            UserId       = user.Id,
            Username     = user.Username,
            Role         = user.Role,
            Token        = token,
            CompanyId    = user.CompanyId,
            DepartmentId = user.DepartmentId
        };

        return Result<LoginResponse>.Success(response);
    }
}
