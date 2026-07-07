using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class LevelOption : BaseEntity
{
    public string Label { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public Guid CreatedByAdminId { get; set; }
    
    // Navigation
    public User? CreatedByAdmin { get; set; }
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
    public ICollection<DepartmentModuleAssignment> Assignments { get; set; } = new List<DepartmentModuleAssignment>();
}
