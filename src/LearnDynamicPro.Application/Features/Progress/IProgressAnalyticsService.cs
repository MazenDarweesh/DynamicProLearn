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
}
