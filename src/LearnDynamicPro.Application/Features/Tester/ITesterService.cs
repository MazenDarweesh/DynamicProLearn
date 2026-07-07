using LearnDynamicPro.Application.Dtos.Tester;

using LearnDynamicPro.Application.Common;

namespace LearnDynamicPro.Application.Features.Tester;

public interface ITesterService
{
    // ERP Version management (Admin)
    Task<Result<ErpVersionDto>> CreateErpVersionAsync(CreateErpVersionRequest request);
    Task<Result<List<ErpVersionDto>>> GetAllErpVersionsAsync();

    // Tester Active Version configuration
    Task<Result> SetActiveVersionAsync(SetActiveVersionRequest request);

    // Feedback submission & retrieval
    Task<Result<FeedbackDto>> SubmitFeedbackAsync(SubmitFeedbackRequest request);
    Task<Result<List<FeedbackDto>>> GetFeedbackByActiveVersionAsync();
}
