using LearnDynamicPro.Application.Dtos.Auth;
using LearnDynamicPro.Application.Interfaces;

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

    public Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        throw new NotImplementedException();
    }
}
