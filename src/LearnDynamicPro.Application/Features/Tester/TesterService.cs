using LearnDynamicPro.Application.Dtos.Tester;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
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

    public async Task<Result<ErpVersionDto>> CreateErpVersionAsync(CreateErpVersionRequest request)
    {
        var version = new ErpVersion { VersionLabel = request.VersionLabel };
        _context.ErpVersions.Add(version);
        await _context.SaveChangesAsync(default);

        return Result<ErpVersionDto>.Success(new ErpVersionDto { Id = version.Id, VersionLabel = version.VersionLabel });
    }

    public async Task<Result<List<ErpVersionDto>>> GetAllErpVersionsAsync()
    {
        var versions = await _context.ErpVersions
            .AsNoTracking()
            .Select(v => new ErpVersionDto { Id = v.Id, VersionLabel = v.VersionLabel })
            .ToListAsync();
            
        return Result<List<ErpVersionDto>>.Success(versions);
    }

    public async Task<Result> SetActiveVersionAsync(SetActiveVersionRequest request)
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _context.TesterActiveVersions
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
        {
            activeVersion = new TesterActiveVersion
            {
                UserId = userId,
                ErpVersionId = request.ErpVersionId,
                BranchName = request.BranchName
            };
            _context.TesterActiveVersions.Add(activeVersion);
        }
        else
        {
            activeVersion.ErpVersionId = request.ErpVersionId;
            activeVersion.BranchName = request.BranchName;
        }

        await _context.SaveChangesAsync(default);
        return Result.Success();
    }

    public async Task<Result<FeedbackDto>> SubmitFeedbackAsync(SubmitFeedbackRequest request)
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _context.TesterActiveVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
            return Result<FeedbackDto>.Failure(AppErrors.Tester.NoActiveVersion);

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

        return Result<FeedbackDto>.Success(new FeedbackDto
        {
            Id = feedback.Id,
            LessonId = feedback.LessonId,
            ErpVersionId = feedback.ErpVersionId,
            ConditionOptionId = feedback.ConditionOptionId,
            Notes = feedback.Notes,
            CreatedAt = feedback.CreatedAt
        });
    }

    public async Task<Result<List<FeedbackDto>>> GetFeedbackByActiveVersionAsync()
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _context.TesterActiveVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
            return Result<List<FeedbackDto>>.Success(new List<FeedbackDto>());

        var feedbacks = await _context.TesterFeedbacks
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
            
        return Result<List<FeedbackDto>>.Success(feedbacks);
    }
}

