using LearnDynamicPro.Application.Dtos.Tester;

using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Tester;

public interface ITesterService
{
    // ERP Version management (Admin)
    Task<Result<ErpVersionDto>> CreateErpVersionAsync(CreateErpVersionRequest request);
    Task<Result<List<ErpVersionDto>>> GetAllErpVersionsAsync();
    Task<Result> UpdateErpVersionAsync(Guid versionId, UpdateErpVersionRequest request);
    Task<Result> DeleteErpVersionAsync(Guid versionId);

    // Tester Active Version configuration
    Task<Result<List<ErpVersionDto>>> GetMyVersionsAsync();
    Task<Result<List<LearnDynamicPro.Application.Dtos.Modules.ModuleDto>>> GetMyModulesAsync();

    // Tester Active Version configuration
    Task<Result> SetActiveVersionAsync(SetActiveVersionRequest request);

    // Feedback submission & retrieval
    Task<Result<FeedbackDto>> SubmitFeedbackAsync(SubmitFeedbackRequest request);
    Task<Result<List<FeedbackDto>>> GetFeedbackByActiveVersionAsync();
    Task<Result<List<LookupDto>>> GetConditionOptionsAsync();

    // Version Testers (New Structure)
    Task<Result<VersionTesterDto>> AssignTesterToVersionAsync(Guid versionId, Guid testerId, List<Guid> moduleIds);
    Task<Result<List<VersionSummaryDto>>> GetVersionSummariesAsync();
    Task<Result<VersionProgressDto>> GetVersionProgressAsync(Guid versionId);

    // Test Cycles
    Task<Result<List<TestCycleDto>>> GetAllTestCyclesAsync();
    Task<Result<TestCycleDto>> CreateTestCycleAsync(CreateTestCycleRequest request);
    Task<Result> AssignModulesToTestCycleAsync(Guid testCycleId, AssignModulesToTestCycleRequest request);
    Task<Result> UpdateTestCycleAsync(Guid testCycleId, UpdateTestCycleRequest request);
    Task<Result> DeleteTestCycleAsync(Guid testCycleId);
}
