using LearnDynamicPro.Application.Dtos.Progress;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Enums;
using Microsoft.EntityFrameworkCore;

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

    public async Task<LessonProgressDto> MarkLessonProgressAsync(MarkCompleteRequest request)
    {
        var userId = _currentUserService.UserId;
        
        var progress = await _context.LessonProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (progress == null)
        {
            progress = new LessonProgress
            {
                UserId = userId,
                LessonId = request.LessonId,
                IsCompleted = request.IsCompleted,
                CompletedAt = request.IsCompleted ? DateTime.UtcNow : null,
                CompletionSource = CompletionSource.Self
            };
            _context.LessonProgresses.Add(progress);
        }
        else
        {
            progress.IsCompleted = request.IsCompleted;
            progress.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;
            progress.CompletionSource = CompletionSource.Self;
            progress.MarkedByUserId = null; // Clear override if student changes it themselves
        }

        await _context.SaveChangesAsync(default);

        return new LessonProgressDto
        {
            UserId = progress.UserId,
            LessonId = progress.LessonId,
            IsCompleted = progress.IsCompleted,
            CompletedAt = progress.CompletedAt
        };
    }

    public async Task<LessonProgressDto> AdminOverrideProgressAsync(AdminOverrideProgressRequest request)
    {
        var adminId = _currentUserService.UserId;
        
        var progress = await _context.LessonProgresses
            .FirstOrDefaultAsync(p => p.UserId == request.UserId && p.LessonId == request.LessonId);

        if (progress == null)
        {
            progress = new LessonProgress
            {
                UserId = request.UserId,
                LessonId = request.LessonId,
                IsCompleted = request.IsCompleted,
                CompletedAt = request.IsCompleted ? DateTime.UtcNow : null,
                CompletionSource = CompletionSource.AdminOverride,
                MarkedByUserId = adminId
            };
            _context.LessonProgresses.Add(progress);
        }
        else
        {
            progress.IsCompleted = request.IsCompleted;
            progress.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;
            progress.CompletionSource = CompletionSource.AdminOverride;
            progress.MarkedByUserId = adminId;
        }

        await _context.SaveChangesAsync(default);

        return new LessonProgressDto
        {
            UserId = progress.UserId,
            LessonId = progress.LessonId,
            IsCompleted = progress.IsCompleted,
            CompletedAt = progress.CompletedAt
        };
    }

    public async Task<UserProgressDto> GetUserProgressAsync(Guid userId)
    {
        var completedCount = await _context.LessonProgresses
            .AsNoTracking()
            .CountAsync(p => p.UserId == userId && p.IsCompleted);

        return new UserProgressDto
        {
            UserId = userId,
            CompletedLessons = completedCount,
            TotalLessons = completedCount // Simplified for now
        };
    }
}

