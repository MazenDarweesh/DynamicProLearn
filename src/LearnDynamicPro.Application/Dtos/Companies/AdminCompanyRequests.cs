using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Application.Dtos.Companies;

public class CreateCompanyRequest
{
    public string Name { get; set; } = string.Empty;
}

public class CreateDepartmentRequest
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class CreateUserRequest
{
    public Guid? CompanyId { get; set; }
    public Guid? DepartmentId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public UserRole Role { get; set; }
}

public class UpdateCompanyRequest
{
    public string Name { get; set; } = string.Empty;
}

public class UpdateDepartmentRequest
{
    public string Name { get; set; } = string.Empty;
}
