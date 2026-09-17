using LearnDynamicPro.Domain.Common;
using LearnDynamicPro.Domain.Entities.AI;

namespace LearnDynamicPro.Domain.Entities;

/// <summary>
/// Represents a student's persistent progress and score on a lesson's AI Quiz.
/// Stored in SQL Server to support cross-device resumption, instant grading persistence, and audit trails.
/// Detailed question-by-question responses are persisted in a JSON column via EF Core .ToJson().
/// </summary>
public class StudentQuizProgress : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid LessonId { get; set; }

    public int TotalQuestions { get; set; }
    public int CorrectCount { get; set; }
    public double ScorePercentage { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime LastAccessedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Stored as a JSON column in SQL Server.
    /// </summary>
    public List<StudentQuizAnswerState> Answers { get; set; } = new();

    // Navigations
    public User? User { get; set; }
    public Lesson? Lesson { get; set; }
}
