using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class Lesson : BaseEntity
{
    public Guid UnitId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string PdfUrl { get; set; } = string.Empty;
    public string ExternalLink { get; set; } = string.Empty;
    public string? ErpKey { get; set; }
    
    public Guid LevelId { get; set; }
    public Guid TypeId { get; set; }
    public int OrderIndex { get; set; }

    // Navigation
    public Unit? Unit { get; set; }
    public LevelOption? Level { get; set; }
    public TypeOption? Type { get; set; }
    public ICollection<LessonProgress> Progresses { get; set; } = new List<LessonProgress>();
    public ICollection<TesterFeedback> Feedbacks { get; set; } = new List<TesterFeedback>();
}
