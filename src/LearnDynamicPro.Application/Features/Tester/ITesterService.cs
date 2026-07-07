using LearnDynamicPro.Application.Dtos.Tester;

namespace LearnDynamicPro.Application.Features.Tester;

public interface ITesterService
{
    // ERP Version management (Admin)
    Task<ErpVersionDto> CreateErpVersionAsync(CreateErpVersionRequest request);
    Task<List<ErpVersionDto>> GetAllErpVersionsAsync();

    // Tester Active Version configuration
    Task SetActiveVersionAsync(SetActiveVersionRequest request);

    // Feedback submission & retrieval
    Task<FeedbackDto> SubmitFeedbackAsync(SubmitFeedbackRequest request);
    Task<List<FeedbackDto>> GetFeedbackByActiveVersionAsync();
}
