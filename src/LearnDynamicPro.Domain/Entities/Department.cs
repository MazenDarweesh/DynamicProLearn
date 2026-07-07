using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class Department : BaseEntity
{
    public Guid CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;

    // Navigation
    public Company? Company { get; set; }
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<DepartmentModuleAssignment> Assignments { get; set; } = new List<DepartmentModuleAssignment>();
}
