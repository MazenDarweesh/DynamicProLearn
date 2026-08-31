using LearnDynamicPro.Application.Dtos.Internal;

namespace LearnDynamicPro.Application.Interfaces;

public interface IPythonAiClient
{
    Task<PythonAiQuizResponseDto?> GenerateQuizAsync(Guid lessonId);
    Task<PythonAiSummaryResponseDto?> GenerateSummaryAsync(Guid lessonId);
}
