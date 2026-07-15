namespace LearnDynamicPro.Application.Dtos.Assignments;

public class AssignModuleRequest
{
    public Guid DepartmentId { get; set; }
    public Guid ModuleId { get; set; }
    public List<Guid> LevelIds { get; set; } = new(); // Empty = any level
    public List<Guid> TypeIds { get; set; } = new();  // Empty = any type
}
