using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class DepartmentModuleAssignment : BaseEntity
{
    public Guid DepartmentId { get; set; }
    public Guid ModuleId { get; set; }
    public Guid? LevelId { get; set; }
    public Guid? TypeId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Department? Department { get; set; }
    public Module? Module { get; set; }
    public LevelOption? Level { get; set; }
    public TypeOption? Type { get; set; }
}
