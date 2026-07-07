using LearnDynamicPro.Application.Dtos.Tester;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

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

    public async Task<ErpVersionDto> CreateErpVersionAsync(CreateErpVersionRequest request)
    {
        var version = new ErpVersion { VersionLabel = request.VersionLabel };
        _context.ErpVersions.Add(version);
        await _context.SaveChangesAsync(default);

        return new ErpVersionDto { Id = version.Id, VersionLabel = version.VersionLabel };
    }

    public async Task<List<ErpVersionDto>> GetAllErpVersionsAsync()
    {
        return await _context.ErpVersions
            .AsNoTracking()
            .Select(v => new ErpVersionDto { Id = v.Id, VersionLabel = v.VersionLabel })
            .ToListAsync();
    }

    public async Task SetActiveVersionAsync(SetActiveVersionRequest request)
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _context.TesterActiveVersions
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
        {
            activeVersion = new TesterActiveVersion
            {
                UserId = userId,
                ErpVersionId = request.ErpVersionId
            };
            _context.TesterActiveVersions.Add(activeVersion);
        }
        else
        {
            activeVersion.ErpVersionId = request.ErpVersionId;
        }

        await _context.SaveChangesAsync(default);
    }

    public async Task<FeedbackDto> SubmitFeedbackAsync(SubmitFeedbackRequest request)
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _context.TesterActiveVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
            throw new InvalidOperationException("No active ERP version set for this tester.");

        var feedback = new TesterFeedback
        {
            UserId = userId,
            LessonId = request.LessonId,
            ErpVersionId = activeVersion.ErpVersionId,
            ConditionOptionId = request.ConditionOptionId,
            Notes = request.Notes
        };

        _context.TesterFeedbacks.Add(feedback);
        await _context.SaveChangesAsync(default);

        return new FeedbackDto
        {
            Id = feedback.Id,
            LessonId = feedback.LessonId,
            ErpVersionId = feedback.ErpVersionId,
            ConditionOptionId = feedback.ConditionOptionId,
            Notes = feedback.Notes,
            CreatedAt = feedback.CreatedAt
        };
    }

    public async Task<List<FeedbackDto>> GetFeedbackByActiveVersionAsync()
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _context.TesterActiveVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
            return new List<FeedbackDto>();

        return await _context.TesterFeedbacks
            .AsNoTracking()
            .Where(f => f.ErpVersionId == activeVersion.ErpVersionId && f.UserId == userId)
            .Select(f => new FeedbackDto
            {
                Id = f.Id,
                LessonId = f.LessonId,
                ErpVersionId = f.ErpVersionId,
                ConditionOptionId = f.ConditionOptionId,
                Notes = f.Notes,
                CreatedAt = f.CreatedAt
            })
            .ToListAsync();
    }
}

