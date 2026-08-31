namespace LearnDynamicPro.Application.Dtos.Internal;

public class PythonAiQuizOptionDto
{
    public string OptionId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}

public class PythonAiQuizQuestionDto
{
    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public List<PythonAiQuizOptionDto> Options { get; set; } = new();
    public string CorrectAnswerId { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
}

public class PythonAiQuizResponseDto
{
    public List<PythonAiQuizQuestionDto> Questions { get; set; } = new();
}

public class PythonAiSummaryTopicDto
{
    public string TopicName { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public List<string> KeyPoints { get; set; } = new();
}

public class PythonAiSummaryResponseDto
{
    public string Overview { get; set; } = string.Empty;
    public List<PythonAiSummaryTopicDto> Topics { get; set; } = new();
}
