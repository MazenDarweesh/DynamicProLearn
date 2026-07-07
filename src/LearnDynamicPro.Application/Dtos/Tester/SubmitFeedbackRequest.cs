namespace LearnDynamicPro.Application.Dtos.Tester;

public class SubmitFeedbackRequest
{
    public Guid LessonId { get; set; }
    public Guid ConditionOptionId { get; set; }
    public string Notes { get; set; } = string.Empty;
}

public class CreateFeedbackConditionRequest
{
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class FeedbackConditionDto
{
    public Guid Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
