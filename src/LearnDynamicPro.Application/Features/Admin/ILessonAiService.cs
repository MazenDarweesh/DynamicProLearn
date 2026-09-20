using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Application.Dtos.Modules;

namespace LearnDynamicPro.Application.Features.Admin;

public interface ILessonAiService
{
    Task<Result<bool>> GenerateLessonQuizAsync(Guid lessonId);
    Task<Result<bool>> GenerateLessonSummaryAsync(Guid lessonId);
    Task<Result<AiJobInfo>> EnqueueLessonQuizGenerationAsync(Guid lessonId);
    Task<Result<AiJobInfo>> EnqueueLessonSummaryGenerationAsync(Guid lessonId);
    AiJobInfo? GetAiJobStatus(Guid lessonId, Guid? jobId = null);
    Task<Result<AdminLessonQuizDto>> GetAdminLessonQuizAsync(Guid lessonId);
    Task<Result<AdminLessonSummaryDto>> GetAdminLessonSummaryAsync(Guid lessonId);
}
