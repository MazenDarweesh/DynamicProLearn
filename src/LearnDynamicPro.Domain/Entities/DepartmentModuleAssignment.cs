using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class DepartmentModuleAssignment : BaseEntity
{
    public Guid DepartmentId { get; set; }
    public Guid ModuleId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Department? Department { get; set; }
    public Module? Module { get; set; }
    
    public ICollection<AssignmentLevelFilter> LevelFilters { get; set; } = new List<AssignmentLevelFilter>();
    public ICollection<AssignmentTypeFilter> TypeFilters { get; set; } = new List<AssignmentTypeFilter>();
}
