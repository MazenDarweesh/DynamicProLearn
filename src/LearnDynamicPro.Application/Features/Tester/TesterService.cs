using LearnDynamicPro.Application.Dtos.Tester;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Application.Features.Tester;

public class TesterService : ITesterService
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public TesterService(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public Task<ErpVersionDto> CreateErpVersionAsync(CreateErpVersionRequest request) => throw new NotImplementedException();
    public Task<List<ErpVersionDto>> GetAllErpVersionsAsync() => throw new NotImplementedException();
    public Task SetActiveVersionAsync(SetActiveVersionRequest request) => throw new NotImplementedException();
    public Task<FeedbackDto> SubmitFeedbackAsync(SubmitFeedbackRequest request) => throw new NotImplementedException();
    public Task<List<FeedbackDto>> GetFeedbackByActiveVersionAsync() => throw new NotImplementedException();
}
