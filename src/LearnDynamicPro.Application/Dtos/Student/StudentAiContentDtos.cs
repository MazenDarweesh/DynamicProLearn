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

public class CheckQuizAnswerRequest
{
    public int QuestionNumber { get; set; }
    public string SelectedOptionId { get; set; } = string.Empty;
}

public class QuestionEvaluationResultDto
{
    public int QuestionNumber { get; set; }
    public string SelectedOptionId { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public string CorrectAnswerId { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}

public class StudentQuizStateDto
{
    public Guid LessonId { get; set; }
    public int TotalQuestions { get; set; }
    public int AnsweredCount { get; set; }
    public int CorrectCount { get; set; }
    public double ScorePercentage { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<QuestionEvaluationResultDto> AnsweredQuestions { get; set; } = new();
}

public class SubmitQuizRequest
{
    public List<CheckQuizAnswerRequest>? Answers { get; set; }
}

public class QuizSubmissionResultDto
{
    public int TotalQuestions { get; set; }
    public int CorrectCount { get; set; }
    public double ScorePercentage { get; set; }
    public bool Passed { get; set; }
    public List<QuestionEvaluationResultDto> Results { get; set; } = new();
}

public class CopilotFilterOptionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class CopilotFilterLessonDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid LevelId { get; set; }
    public Guid TypeId { get; set; }
}

public class CopilotFilterUnitDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public List<CopilotFilterLessonDto> Lessons { get; set; } = new();
}

public class CopilotFilterModuleDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public List<CopilotFilterUnitDto> Units { get; set; } = new();
}

public class StudentCopilotFilterDataDto
{
    public List<CopilotFilterModuleDto> Modules { get; set; } = new();
    public List<CopilotFilterOptionDto> Levels { get; set; } = new();
    public List<CopilotFilterOptionDto> Types { get; set; } = new();
}


