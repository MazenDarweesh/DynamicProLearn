using LearnDynamicPro.Application.Dtos.Progress;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;

namespace LearnDynamicPro.Application.Features.Progress;

public class ProgressService : IProgressService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;

    public ProgressService(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
    }

    public async Task<Result<LessonProgressDto>> MarkLessonProgressAsync(MarkCompleteRequest request)
    {
        var userId = _currentUserService.UserId;
        
        var progress = await _unitOfWork.Repository<LessonProgress>().Query()
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
            _unitOfWork.Repository<LessonProgress>().AddAsync(progress);
        }
        else
        {
            progress.IsCompleted = request.IsCompleted;
            progress.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;
            progress.CompletionSource = CompletionSource.Self;
            progress.MarkedByUserId = null; // Clear override if student changes it themselves
        }

        await _unitOfWork.SaveChangesAsync();

        return Result<LessonProgressDto>.Success(new LessonProgressDto
        {
            UserId = progress.UserId,
            LessonId = progress.LessonId,
            IsCompleted = progress.IsCompleted,
            CompletedAt = progress.CompletedAt
        });
    }

    public async Task<Result<LessonProgressDto>> AdminOverrideProgressAsync(AdminOverrideProgressRequest request)
    {
        var adminId = _currentUserService.UserId;
        
        var progress = await _unitOfWork.Repository<LessonProgress>().Query()
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
            _unitOfWork.Repository<LessonProgress>().AddAsync(progress);
        }
        else
        {
            progress.IsCompleted = request.IsCompleted;
            progress.CompletedAt = request.IsCompleted ? DateTime.UtcNow : null;
            progress.CompletionSource = CompletionSource.AdminOverride;
            progress.MarkedByUserId = adminId;
        }

        await _unitOfWork.SaveChangesAsync();

        return Result<LessonProgressDto>.Success(new LessonProgressDto
        {
            UserId = progress.UserId,
            LessonId = progress.LessonId,
            IsCompleted = progress.IsCompleted,
            CompletedAt = progress.CompletedAt
        });
    }

    public async Task<Result<UserProgressDto>> GetUserProgressAsync(Guid userId)
    {
        var user = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
            
        if (user == null)
            return Result<UserProgressDto>.Failure(AppErrors.Authentication.UserNotFound);

        // 1. IQueryable for user's department assignments
        var deptAssignments = _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .Where(a => a.DepartmentId == user.DepartmentId);

        // 2. IQueryable for accessible lessons applying intersection logic in SQL
        var accessibleLessons = _unitOfWork.Repository<Lesson>().Query()
            .Where(lesson => deptAssignments.Any(a =>
                a.ModuleId == lesson.Unit!.ModuleId &&
                (a.LevelId == null || a.LevelId == lesson.LevelId) &&
                (a.TypeId == null || a.TypeId == lesson.TypeId)));

        // 3. Aggregate stats via SQL GroupBy
        var modulesProgress = await accessibleLessons
            .GroupBy(l => new { l.Unit!.ModuleId, ModuleName = l.Unit.Module!.Name })
            .Select(g => new ModuleProgressDto
            {
                ModuleId = g.Key.ModuleId,
                ModuleName = g.Key.ModuleName,
                TotalLessons = g.Count(),
                CompletedLessons = g.Count(l => _unitOfWork.Repository<LessonProgress>().Query().Any(p => p.UserId == userId && p.LessonId == l.Id && p.IsCompleted))
            })
            .OrderBy(m => m.ModuleName)
            .ToListAsync();

        var response = new UserProgressDto
        {
            UserId = userId,
            Username = user.Username,
            TotalLessons = modulesProgress.Sum(m => m.TotalLessons),
            CompletedLessons = modulesProgress.Sum(m => m.CompletedLessons),
            ModulesProgress = modulesProgress
        };
        return Result<UserProgressDto>.Success(response);
    }
}

