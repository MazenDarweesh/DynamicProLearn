using LearnDynamicPro.Application.Dtos.Progress;

namespace LearnDynamicPro.Application.Features.Progress;

public interface IProgressService
{
    // Students marking lessons completed
    Task<LessonProgressDto> MarkLessonProgressAsync(MarkCompleteRequest request);
    
    // Admins manually overriding student progress
    Task<LessonProgressDto> AdminOverrideProgressAsync(AdminOverrideProgressRequest request);
    
    // Get progress percentages overall and by module
    Task<UserProgressDto> GetUserProgressAsync(Guid userId);
}
