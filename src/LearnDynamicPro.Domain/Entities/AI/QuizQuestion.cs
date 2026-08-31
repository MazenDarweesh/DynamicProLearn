namespace LearnDynamicPro.Domain.Entities.AI;

/// <summary>
/// Represents a single question inside a LessonQuiz.
/// The entire list is serialized as a JSON column in the LessonQuizzes table.
/// Not a BaseEntity — owned value object, no independent lifecycle.
/// </summary>
public class QuizQuestion
{
    /// <summary>Sequential question number (1-based).</summary>
    public int QuestionNumber { get; set; }

    /// <summary>The question text displayed to the student.</summary>
    public string QuestionText { get; set; } = string.Empty;

    /// <summary>All answer choices for this question.</summary>
    public List<QuizOption> Options { get; set; } = new();

    /// <summary>
    /// The OptionId of the correct answer.
    /// CRITICAL: This field is present in the DB JSON but must be stripped from
    /// any DTO returned to the Student UI. Only used during SubmitQuizCommand evaluation.
    /// </summary>
    public string CorrectAnswerId { get; set; } = string.Empty;

    /// <summary>
    /// Explanation shown to the student AFTER submitting (not during the quiz).
    /// Must also be stripped from student-facing DTOs until after submission.
    /// </summary>
    public string Explanation { get; set; } = string.Empty;
}
