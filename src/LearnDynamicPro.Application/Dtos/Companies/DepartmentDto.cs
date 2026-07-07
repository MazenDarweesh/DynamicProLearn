namespace LearnDynamicPro.Application.Dtos.Companies;

public class DepartmentDto
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
}
