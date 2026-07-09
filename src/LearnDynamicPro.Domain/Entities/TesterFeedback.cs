using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class TesterFeedback : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public Guid ErpVersionId { get; set; }
    public Guid ConditionOptionId { get; set; }
    public string Notes { get; set; } = string.Empty;

    // Navigation
    public User? User { get; set; }
    public Lesson? Lesson { get; set; }
    public ErpVersion? ErpVersion { get; set; }
    public FeedbackConditionOption? ConditionOption { get; set; }
}
