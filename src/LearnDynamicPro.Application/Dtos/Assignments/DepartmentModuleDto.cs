namespace LearnDynamicPro.Application.Dtos.Assignments;

public class DepartmentModuleDto
{
    public Guid Id { get; set; }
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public Guid ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    
    public List<Guid> LevelIds { get; set; } = new();
    public List<string> LevelLabels { get; set; } = new();
    
    public List<Guid> TypeIds { get; set; } = new();
    public List<string> TypeLabels { get; set; } = new();
    
    public DateTime AssignedAt { get; set; }
}
