using LearnDynamicPro.Application.Dtos.Progress;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Application.Features.Progress;

public class ProgressService : IProgressService
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ProgressService(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public Task<LessonProgressDto> MarkLessonProgressAsync(MarkCompleteRequest request) => throw new NotImplementedException();
    public Task<LessonProgressDto> AdminOverrideProgressAsync(AdminOverrideProgressRequest request) => throw new NotImplementedException();
    public Task<UserProgressDto> GetUserProgressAsync(Guid userId) => throw new NotImplementedException();
}
