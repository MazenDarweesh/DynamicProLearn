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

        // 3. Generate JWT access and refresh tokens
        var token = _tokenService.GenerateToken(user);
        var refreshToken = _tokenService.GenerateRefreshToken(user);

        var response = new LoginResponse
        {
            UserId       = user.Id,
            Username     = user.Username,
            Role         = user.Role,
            Token        = token,
            RefreshToken = refreshToken,
            CompanyId    = user.CompanyId,
            DepartmentId = user.DepartmentId
        };

        return Result<LoginResponse>.Success(response);
    }

    public async Task<Result<ErpLoginResponse>> ErpLoginAsync(ErpLoginRequest request)
    {
        var user = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower());

        if (user is null)
            return Result<ErpLoginResponse>.Failure(AppErrors.Authentication.InvalidCredentials);

        bool isValid = false;
        if (request.Password == user.PasswordHash) 
        {
            isValid = true;
        }
        else if (_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            isValid = true;
        }

        if (!isValid)
            return Result<ErpLoginResponse>.Failure(AppErrors.Authentication.InvalidCredentials);

        var token = _tokenService.GenerateToken(user);
        var refreshToken = _tokenService.GenerateRefreshToken(user);

        ErpRedirectDto? erpRedirect = null;
        if (!string.IsNullOrWhiteSpace(request.ErpKey))
        {
            var redirectData = await _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => l.ErpKey == request.ErpKey)
                .Select(l => new
                {
                    LessonId = l.Id,
                    ModuleId = l.Unit!.ModuleId
                })
                .FirstOrDefaultAsync();
            
            if (redirectData != null)
            {
                erpRedirect = new ErpRedirectDto
                {
                    ModuleId = redirectData.ModuleId,
                    LessonId = redirectData.LessonId
                };
            }
        }

        var response = new ErpLoginResponse
        {
            UserId       = user.Id,
            Username     = user.Username,
            Role         = user.Role,
            Token        = token,
            RefreshToken = refreshToken,
            CompanyId    = user.CompanyId,
            DepartmentId = user.DepartmentId,
            ErpRedirect  = erpRedirect
        };

        return Result<ErpLoginResponse>.Success(response);
    }

    public async Task<Result<LoginResponse>> RefreshTokenAsync(RefreshTokenRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.RefreshToken))
            return Result<LoginResponse>.Failure(AppErrors.Authentication.InvalidCredentials);

        // 1. Validate the refresh token signature and lifetime
        if (!_tokenService.ValidateRefreshToken(request.RefreshToken, out var userId))
        {
            return Result<LoginResponse>.Failure("Invalid or expired refresh token.");
        }

        // 2. Fetch the user to ensure account is still active and valid
        var user = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user is null)
        {
            return Result<LoginResponse>.Failure("User associated with token no longer exists.");
        }

        // 3. Issue fresh access token and refresh token
        var newToken = _tokenService.GenerateToken(user);
        var newRefreshToken = _tokenService.GenerateRefreshToken(user);

        var response = new LoginResponse
        {
            UserId       = user.Id,
            Username     = user.Username,
            Role         = user.Role,
            Token        = newToken,
            RefreshToken = newRefreshToken,
            CompanyId    = user.CompanyId,
            DepartmentId = user.DepartmentId
        };

        return Result<LoginResponse>.Success(response);
    }
}
