using LearnDynamicPro.Domain.Enums;

using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class LessonProgress : ISoftDeletable
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public CompletionSource CompletionSource { get; set; }
    public Guid? MarkedByUserId { get; set; }
    public DateTime LastAccessedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;

    // Navigation
    public User? User { get; set; }
    public Lesson? Lesson { get; set; }
    public User? MarkedByUser { get; set; }
}
