namespace LearnDynamicPro.Application.Dtos.Internal;

using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

public class GeneratedQuizDto
{
    [JsonPropertyName("lesson_id")]
    public string LessonId { get; set; } = string.Empty;

    [JsonPropertyName("generated_at")]
    public DateTime GeneratedAt { get; set; }

    [JsonPropertyName("questions")]
    public List<QuizQuestionDto> Questions { get; set; } = new();
}

public class QuizQuestionDto
{
    [JsonPropertyName("id")]
    public int QuestionNumber { get; set; }

    [JsonPropertyName("question")]
    public string QuestionText { get; set; } = string.Empty;

    [JsonPropertyName("options")]
    public List<QuizOptionDto> Options { get; set; } = new();

    [JsonPropertyName("correct_answer_id")]
    public string CorrectAnswerId { get; set; } = string.Empty;

    [JsonPropertyName("explanation")]
    public string Explanation { get; set; } = string.Empty;
}

public class QuizOptionDto
{
    [JsonPropertyName("id")]
    public string OptionId { get; set; } = string.Empty;

    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;
}

public class GeneratedSummaryDto
{
    [JsonPropertyName("lesson_id")]
    public string LessonId { get; set; } = string.Empty;

    [JsonPropertyName("overview")]
    public string Overview { get; set; } = string.Empty;

    [JsonPropertyName("generated_at")]
    public DateTime GeneratedAt { get; set; }

    [JsonPropertyName("topics")]
    public List<SummaryTopicDto> Topics { get; set; } = new();
}

public class SummaryTopicDto
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("points")]
    public List<string> Points { get; set; } = new();
}
