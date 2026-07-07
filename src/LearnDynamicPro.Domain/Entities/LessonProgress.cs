using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Domain.Entities;

public class LessonProgress
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public CompletionSource CompletionSource { get; set; }
    public Guid? MarkedByUserId { get; set; }

    // Navigation
    public User? User { get; set; }
    public Lesson? Lesson { get; set; }
    public User? MarkedByUser { get; set; }
}
