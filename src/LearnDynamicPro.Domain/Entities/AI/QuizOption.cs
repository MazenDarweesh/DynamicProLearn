namespace LearnDynamicPro.Domain.Entities.AI;

/// <summary>
/// Represents a single answer choice for a quiz question.
/// Stored as a JSON sub-object inside the QuizQuestion JSON array.
/// Not a BaseEntity — it has no independent lifecycle.
/// </summary>
public class QuizOption
{
    /// <summary>Unique identifier within this question (e.g. "A", "B", "C", "D")</summary>
    public string OptionId { get; set; } = string.Empty;

    /// <summary>Display text of the option.</summary>
    public string Text { get; set; } = string.Empty;
}
