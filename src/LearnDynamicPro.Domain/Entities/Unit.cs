using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class Unit : BaseEntity
{
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int OrderIndex { get; set; }

    // Navigation
    public Module? Module { get; set; }
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
}
