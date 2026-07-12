namespace LearnDynamicPro.Application.Dtos.Companies;

public class UserProgressDto
{
    public Guid UserId { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string AssignedModules { get; set; } = string.Empty; // Comma separated module names
    public Guid? CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public int CompletedLessons { get; set; }
    public int TotalLessons { get; set; }
    public double ProgressPercentage => TotalLessons == 0 ? 0 : Math.Round((double)CompletedLessons / TotalLessons * 100, 1);
}
