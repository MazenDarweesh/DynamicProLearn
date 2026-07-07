namespace LearnDynamicPro.Application.Dtos.Progress;

public class UserProgressDto
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public int TotalLessons { get; set; }
    public int CompletedLessons { get; set; }
    public double ProgressPercentage => TotalLessons == 0 ? 0.0 : Math.Round((double)CompletedLessons / TotalLessons * 100, 2);
    
    public List<ModuleProgressDto> ModulesProgress { get; set; } = new List<ModuleProgressDto>();
}

public class ModuleProgressDto
{
    public Guid ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    public int TotalLessons { get; set; }
    public int CompletedLessons { get; set; }
    public double ProgressPercentage => TotalLessons == 0 ? 0.0 : Math.Round((double)CompletedLessons / TotalLessons * 100, 2);
}
