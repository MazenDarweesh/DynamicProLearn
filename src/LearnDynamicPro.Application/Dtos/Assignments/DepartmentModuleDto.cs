namespace LearnDynamicPro.Application.Dtos.Assignments;

public class DepartmentModuleDto
{
    public Guid Id { get; set; }
    public Guid DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public Guid ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    
    public Guid? LevelId { get; set; }
    public string LevelLabel { get; set; } = string.Empty;
    
    public Guid? TypeId { get; set; }
    public string TypeLabel { get; set; } = string.Empty;
    
    public DateTime AssignedAt { get; set; }
}
