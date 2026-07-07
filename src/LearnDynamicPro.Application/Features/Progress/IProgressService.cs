using LearnDynamicPro.Application.Dtos.Progress;

using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Progress;

public interface IProgressService
{
    // Students marking lessons completed
    Task<Result<LessonProgressDto>> MarkLessonProgressAsync(MarkCompleteRequest request);
    
    // Admins manually overriding student progress
    Task<Result<LessonProgressDto>> AdminOverrideProgressAsync(AdminOverrideProgressRequest request);
    
    // Get progress percentages overall and by module
    Task<Result<UserProgressDto>> GetUserProgressAsync(Guid userId);
}
