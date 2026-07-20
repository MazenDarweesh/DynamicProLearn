using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class Module : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    // Navigation
    public ICollection<Unit> Units { get; set; } = new List<Unit>();
    public ICollection<DepartmentModuleAssignment> Assignments { get; set; } = new List<DepartmentModuleAssignment>();
    public ICollection<VersionTesterModule> VersionTesterModules { get; set; } = new List<VersionTesterModule>();
}
