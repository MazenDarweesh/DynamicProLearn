namespace LearnDynamicPro.Application.Dtos.Tester;

public class FeedbackDto
{
    public Guid Id { get; set; }
    
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    
    public Guid LessonId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    
    public Guid ErpVersionId { get; set; }
    public string ErpVersionLabel { get; set; } = string.Empty;
    
    public Guid ConditionOptionId { get; set; }
    public string ConditionLabel { get; set; } = string.Empty;
    
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
