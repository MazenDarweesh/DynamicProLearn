using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Application.Dtos.Companies;

public class UserDto
{
    public Guid Id { get; set; }
    public Guid? CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}
