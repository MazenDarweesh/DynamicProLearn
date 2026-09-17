namespace LearnDynamicPro.Domain.Entities.AI;

/// <summary>
/// Represents the recorded answer and evaluation of a single question in a student's quiz attempt.
/// Owned type stored inside the JSON Answers column of StudentQuizProgress.
/// </summary>
public class StudentQuizAnswerState
{
    public int QuestionNumber { get; set; }
    public string SelectedOptionId { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public string CorrectAnswerId { get; set; } = string.Empty;
    public string Explanation { get; set; } = string.Empty;
    public DateTime AnsweredAt { get; set; } = DateTime.UtcNow;
}
