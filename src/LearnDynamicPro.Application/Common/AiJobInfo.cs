using System;

namespace LearnDynamicPro.Application.Common;

public enum AiJobStatus
{
    Pending,
    Processing,
    Completed,
    Failed
}

public class AiJobInfo
{
    public Guid JobId { get; set; } = Guid.NewGuid();
    public Guid LessonId { get; set; }
    public string JobType { get; set; } = string.Empty; // "Quiz" or "Summary"
    public AiJobStatus Status { get; set; } = AiJobStatus.Pending;
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
