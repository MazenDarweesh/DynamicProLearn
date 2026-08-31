namespace LearnDynamicPro.Application.Dtos.Student;

public class StudentQuizOptionDto
{
    public string OptionId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

public class StudentQuizQuestionDto
{
    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public List<StudentQuizOptionDto> Options { get; set; } = new();
    
    // CRITICAL: Notice that CorrectAnswerId and Explanation are explicitly excluded here to prevent cheating on the frontend!
}

public class StudentLessonQuizDto
{
    public Guid LessonId { get; set; }
    public List<StudentQuizQuestionDto> Questions { get; set; } = new();
}

public class StudentSummaryTopicDto
{
    public string TopicName { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public List<string> KeyPoints { get; set; } = new();
}

public class StudentLessonSummaryDto
{
    public Guid LessonId { get; set; }
    public string Overview { get; set; } = string.Empty;
    public List<StudentSummaryTopicDto> Topics { get; set; } = new();
}
