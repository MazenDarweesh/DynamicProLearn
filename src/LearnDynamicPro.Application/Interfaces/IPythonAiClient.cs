using LearnDynamicPro.Application.Dtos.Internal;

namespace LearnDynamicPro.Application.Interfaces;

public interface IPythonAiClient
{
    Task<GeneratedQuizDto?> GenerateQuizAsync(Guid lessonId);
    Task<GeneratedSummaryDto?> GenerateSummaryAsync(Guid lessonId);
    Task<bool> ClearAiCacheAsync();
}
