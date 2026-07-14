using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Application.Dtos.Auth;

public class ErpLoginResponse : LoginResponse
{
    public ErpRedirectDto? ErpRedirect { get; set; }
}
