using LearnDynamicPro.Application.Dtos.Auth;

namespace LearnDynamicPro.Application.Features.Auth;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
}
