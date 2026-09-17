using System.Text.Json.Serialization;

namespace LearnDynamicPro.Application.Dtos.Internal;

public class LessonAiStatusCallbackDto
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("chunks_count")]
    public int? ChunksCount { get; set; }

    [JsonPropertyName("current_stage")]
    public string? CurrentStage { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}
