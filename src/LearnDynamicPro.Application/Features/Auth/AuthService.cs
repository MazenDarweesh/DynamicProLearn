using LearnDynamicPro.Application.Dtos.Auth;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Domain.Entities;

namespace LearnDynamicPro.Application.Features.Auth;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITokenService _tokenService;

    public AuthService(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        ITokenService tokenService)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    public async Task<Result<LoginResponse>> LoginAsync(LoginRequest request)
    {
        // 1. Find user by username (case-insensitive)
        var user = await _unitOfWork.Repository<User>().Query()
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
