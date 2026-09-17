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
    /// <summary>ترتيب الدرس داخل مستواه (Level) - يُستخدم لتجميع وعرض الدروس مرتبة بداخل كل مستوى</summary>
    public int LevelOrderIndex { get; set; }

    // Navigation
    public Unit? Unit { get; set; }
    public LevelOption? Level { get; set; }
    public TypeOption? Type { get; set; }
    public ICollection<LessonProgress> Progresses { get; set; } = new List<LessonProgress>();
    public ICollection<TesterFeedback> Feedbacks { get; set; } = new List<TesterFeedback>();

    // AI-Generated Content (nullable — generated on demand by Admin)
    public LessonQuiz? Quiz { get; set; }
    public LessonSummary? Summary { get; set; }

    // AI Ingestion & Processing Lifecycle
    public LearnDynamicPro.Domain.Enums.LessonAiStatus AiStatus { get; set; } = LearnDynamicPro.Domain.Enums.LessonAiStatus.None;
    public string? AiError { get; set; }
    public int AiChunksCount { get; set; } = 0;
    public DateTime? AiProcessedAt { get; set; }
    public int AiRetryCount { get; set; } = 0;
}
