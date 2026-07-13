namespace LearnDynamicPro.Application.Dtos.Companies;

public class UpdateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string? Password { get; set; }
    public Guid? CompanyId { get; set; }
    public Guid? DepartmentId { get; set; }
}
