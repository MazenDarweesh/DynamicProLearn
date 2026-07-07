namespace LearnDynamicPro.Application.Dtos.Progress;

public class MarkCompleteRequest
{
    public Guid LessonId { get; set; }
    public bool IsCompleted { get; set; }
}

public class AdminOverrideProgressRequest
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }
    public bool IsCompleted { get; set; }
}
