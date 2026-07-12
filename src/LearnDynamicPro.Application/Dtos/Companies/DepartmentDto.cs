namespace LearnDynamicPro.Application.Dtos.Companies;

public class DepartmentDto
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CompletedLessons { get; set; }
    public int TotalLessons { get; set; }
    public double ProgressPercentage { get; set; }
}
