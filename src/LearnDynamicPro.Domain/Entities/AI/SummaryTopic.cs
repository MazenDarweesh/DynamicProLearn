namespace LearnDynamicPro.Domain.Entities.AI;

/// <summary>
/// Represents a single conceptual topic inside a LessonSummary.
/// The entire list is serialized as a JSON column in the LessonSummaries table.
/// Not a BaseEntity — owned value object, no independent lifecycle.
/// </summary>
public class SummaryTopic
{
    /// <summary>The name or title of this topic/concept.</summary>
    public string TopicName { get; set; } = string.Empty;

    /// <summary>A concise explanation of the topic in student-friendly language.</summary>
    public string Explanation { get; set; } = string.Empty;

    /// <summary>
    /// Optional list of key points or bullet-point takeaways for this topic.
    /// Stored as a JSON array of strings inside the topic JSON object.
    /// </summary>
    public List<string> KeyPoints { get; set; } = new();
}
