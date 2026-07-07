namespace LearnDynamicPro.Application.Dtos.Assignments;

public class AssignModuleRequest
{
    public Guid DepartmentId { get; set; }
    public Guid ModuleId { get; set; }
    public Guid? LevelId { get; set; } // Nullable = any level
    public Guid? TypeId { get; set; }  // Nullable = any type
}
