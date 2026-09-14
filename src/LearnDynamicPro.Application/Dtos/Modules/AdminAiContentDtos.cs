namespace LearnDynamicPro.Application.Dtos.Modules;

public class AdminQuizOptionDto
{
    public string OptionId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

public class AdminQuizQuestionDto
{
    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public List<AdminQuizOptionDto> Options { get; set; } = new();
    public string CorrectAnswerId { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}

public class AdminLessonQuizDto
{
    public Guid LessonId { get; set; }
    public DateTime GeneratedAt { get; set; }
    public List<AdminQuizQuestionDto> Questions { get; set; } = new();
}

public class AdminSummaryTopicDto
{
    public string TopicName { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public List<string> KeyPoints { get; set; } = new();
}

public class AdminLessonSummaryDto
{
    public Guid LessonId { get; set; }
    public string Overview { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; }
    public List<AdminSummaryTopicDto> Topics { get; set; } = new();
}
