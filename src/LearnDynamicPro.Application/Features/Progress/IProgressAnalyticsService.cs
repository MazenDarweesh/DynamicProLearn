using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using LearnDynamicPro.Application.Dtos.Progress;

namespace LearnDynamicPro.Application.Features.Progress;

public interface IProgressAnalyticsService
{
    Task<Dictionary<Guid, ProgressResult>> GetUsersProgressAsync(List<Guid> userIds);
    Task<Dictionary<Guid, ProgressResult>> GetDepartmentsProgressAsync(List<Guid> departmentIds);
    Task<Dictionary<Guid, ProgressResult>> GetCompaniesProgressAsync(List<Guid> companyIds);
    Task<ProgressResult> GetOverallSystemProgressAsync();
    
    // Content-Centric Analytics
    Task<LearnDynamicPro.Application.Common.Result<List<ModuleAnalyticsDto>>> GetCurriculumAnalyticsAsync();
    Task<LearnDynamicPro.Application.Common.Result<LessonDetailsAnalyticsDto>> GetLessonAnalyticsAsync(Guid lessonId);
    Task<LearnDynamicPro.Application.Common.Result> CompleteLessonForTargetAsync(Guid lessonId, string targetType, Guid targetId);
}
