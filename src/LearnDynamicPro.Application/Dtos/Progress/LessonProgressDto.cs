using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Application.Dtos.Progress;

public class LessonProgressDto
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public CompletionSource CompletionSource { get; set; }
    public Guid? MarkedByUserId { get; set; }
    public string MarkedByUsername { get; set; } = string.Empty;
}
