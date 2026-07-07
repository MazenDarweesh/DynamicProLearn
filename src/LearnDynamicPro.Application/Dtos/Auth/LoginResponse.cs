using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Application.Dtos.Auth;

public class LoginResponse
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string Token { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public Guid DepartmentId { get; set; }
}
