using LearnDynamicPro.Application.Dtos.Auth;

using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Auth;

public interface IAuthService
{
    Task<Result<LoginResponse>> LoginAsync(LoginRequest request);
}
