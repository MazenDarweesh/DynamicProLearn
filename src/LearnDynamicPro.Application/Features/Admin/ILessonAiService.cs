using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Admin;

public interface ILessonAiService
{
    Task<Result<bool>> GenerateLessonQuizAsync(Guid lessonId);
    Task<Result<bool>> GenerateLessonSummaryAsync(Guid lessonId);
}
