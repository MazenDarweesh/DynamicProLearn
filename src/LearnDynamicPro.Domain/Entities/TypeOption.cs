using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class TypeOption : BaseEntity
{
    public string Label { get; set; } = string.Empty;
    public Guid CreatedByAdminId { get; set; }

    // Navigation
    public User? CreatedByAdmin { get; set; }
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
}
