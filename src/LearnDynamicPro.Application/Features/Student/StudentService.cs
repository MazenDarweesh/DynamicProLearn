using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
using LearnDynamicPro.Application.Dtos.Student;

namespace LearnDynamicPro.Application.Features.Student;

public class StudentService : IStudentService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IApplicationDbContext _context;

    public StudentService(IUnitOfWork unitOfWork, IApplicationDbContext context)
    {
        _unitOfWork = unitOfWork;
        _context = context;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetAssignedModules
    // Logic: find the student → get their department → get assignments for that
    //        department → project to ModuleDto (distinct, because a module can
    //        appear multiple times with different Level/Type combos).
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<Result<List<ModuleDto>>> GetAssignedModulesAsync(Guid userId)
    {
        var userInfo = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.DepartmentId, u.Role })
            .FirstOrDefaultAsync();

        if (userInfo == null)
            return Result<List<ModuleDto>>.Failure(AppErrors.Authentication.UserNotFound);

        if (userInfo.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester)
        {
            var testerModules = await _unitOfWork.Repository<VersionTester>().Query()
                .AsNoTracking()
                .Where(tc => tc.TesterId == userId)
                .SelectMany(tc => tc.AssignedModules)
                .Where(am => am.Module != null)
                .Select(am => new ModuleDto
                {
                    Id = am.Module!.Id,
                    Name = am.Module.Name,
                    Description = am.Module.Description
                })
                .Distinct()
                .OrderBy(m => m.Name)
                .ToListAsync();

            return Result<List<ModuleDto>>.Success(testerModules);
        }

        if (!userInfo.DepartmentId.HasValue || userInfo.DepartmentId == Guid.Empty)
            return Result<List<ModuleDto>>.Failure(AppErrors.Authentication.UserNotFound);

        var modules = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.DepartmentId == userInfo.DepartmentId)
            .Select(a => new ModuleDto
            {
                Id          = a.Module!.Id,
                Name        = a.Module.Name,
                Description = a.Module.Description
            })
            .Distinct()
            .OrderBy(m => m.Name)
            .ToListAsync();

        return Result<List<ModuleDto>>.Success(modules);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetUnitsByModule — no filtering here; units are structural containers
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<Result<List<UnitDto>>> GetUnitsByModuleAsync(Guid moduleId)
    {
        var units = await _unitOfWork.Repository<Unit>().Query()
            .AsNoTracking()
            .Where(u => u.ModuleId == moduleId)
            .OrderBy(u => u.OrderIndex)
            .Select(u => new UnitDto
            {
                Id         = u.Id,
                ModuleId   = u.ModuleId,
                Name       = u.Name,
                OrderIndex = u.OrderIndex
            })
            .ToListAsync();

        return Result<List<UnitDto>>.Success(units);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetLessonsByUnit — HERE lives the INTERSECTION FILTER
    //
    // Algorithm:
    //   1. Find the assignment(s) for the student's department that cover this
    //      unit's parent module.
    //   2. For each lesson in the unit, a lesson is VISIBLE only if ALL
    //      non-null filter fields in the assignment match the lesson:
    //        • If LevelId IS set  → lesson.LevelId MUST equal assignment.LevelId
    //        • If LevelId IS NULL → any level is accepted
    //        • Same rule for TypeId
    //   3. Because a department can have multiple assignments for the same
    //      module (each with a different combo), a lesson passes if it
    //      satisfies AT LEAST ONE assignment row (union of combos).
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<Result<List<LessonDto>>> GetLessonsByUnitAsync(Guid unitId, Guid userId)
    {
        var userInfo = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.DepartmentId, u.Role })
            .FirstOrDefaultAsync();
            
        if (userInfo == null)
            return Result<List<LessonDto>>.Failure(AppErrors.Authentication.UserNotFound);

        var moduleId = await _unitOfWork.Repository<Unit>().Query()
            .AsNoTracking()
            .Where(u => u.Id == unitId)
            .Select(u => u.ModuleId)
            .FirstOrDefaultAsync();

        IQueryable<Lesson> accessibleLessonsQuery;

        if (userInfo.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester)
        {
            var activeVersion = await _unitOfWork.Repository<TesterActiveVersion>().Query()
                .FirstOrDefaultAsync(t => t.UserId == userId);

            if (activeVersion == null)
                return Result<List<LessonDto>>.Success(new List<LessonDto>());

            var hasAccess = await _unitOfWork.Repository<VersionTester>().Query()
                .AnyAsync(vt => vt.TesterId == userId && vt.VersionId == activeVersion.ErpVersionId && vt.AssignedModules.Any(am => am.ModuleId == moduleId));

            if (!hasAccess)
                return Result<List<LessonDto>>.Success(new List<LessonDto>());

            accessibleLessonsQuery = _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => l.UnitId == unitId);
        }
        else
        {
            var assignments = _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
                .Where(a => a.DepartmentId == userInfo.DepartmentId && a.ModuleId == moduleId);

            accessibleLessonsQuery = _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => l.UnitId == unitId && assignments.Any(a =>
                    (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                    (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId))
                ));
        }

        var lessonProjections = await accessibleLessonsQuery
            .OrderBy(l => l.Level!.SortOrder)
            .ThenBy(l => l.LevelOrderIndex)
            .ThenBy(l => l.CreatedAt)
            .Select(l => new 
            {
                l.Id,
                l.UnitId,
                l.Title,
                l.Description,
                l.LevelId,
                LevelLabel = l.Level!.Label,
                l.TypeId,
                TypeLabel = l.Type!.Label,
                l.OrderIndex,
                l.LevelOrderIndex,
                LevelSortOrder = l.Level!.SortOrder,
                l.PdfUrl,
                l.ExternalLink
            })
            .ToListAsync();

        if (!lessonProjections.Any())
            return Result<List<LessonDto>>.Success(new List<LessonDto>());

        var lessonIds = lessonProjections.Select(l => l.Id).ToList();
        var completedLessonIds = await _unitOfWork.Repository<LessonProgress>().Query()
            .AsNoTracking()
            .Where(lp => lp.UserId == userId && lessonIds.Contains(lp.LessonId) && lp.IsCompleted)
            .Select(lp => lp.LessonId)
            .ToHashSetAsync();

        var quizLessonIds = await _context.LessonQuizzes.AsNoTracking()
            .Where(q => lessonIds.Contains(q.LessonId))
            .Select(q => q.LessonId)
            .ToHashSetAsync();

        var summaryLessonIds = await _context.LessonSummaries.AsNoTracking()
            .Where(s => lessonIds.Contains(s.LessonId))
            .Select(s => s.LessonId)
            .ToHashSetAsync();

        var dtos = lessonProjections.Select(l => new LessonDto
        {
            Id          = l.Id,
            UnitId      = l.UnitId,
            Title       = l.Title,
            Description = l.Description,
            LevelId     = l.LevelId,
            LevelLabel  = l.LevelLabel ?? string.Empty,
            LevelSortOrder = l.LevelSortOrder,
            TypeId      = l.TypeId,
            TypeLabel   = l.TypeLabel ?? string.Empty,
            OrderIndex  = l.OrderIndex,
            LevelOrderIndex = l.LevelOrderIndex,
            IsCompleted = completedLessonIds.Contains(l.Id),
            HasQuiz     = quizLessonIds.Contains(l.Id),
            HasSummary  = summaryLessonIds.Contains(l.Id),
            PdfUrl      = l.PdfUrl,
            ExternalLink = l.ExternalLink
        }).ToList();

        return Result<List<LessonDto>>.Success(dtos);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetLessonDetail — single lesson with VideoUrl (only after access check)
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<Result<LessonDetailDto>> GetLessonDetailAsync(Guid lessonId, Guid userId)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().Query()
            .AsNoTracking()
            .Include(l => l.Level)
            .Include(l => l.Type)
            .FirstOrDefaultAsync(l => l.Id == lessonId);
            
        if (lesson == null)
            return Result<LessonDetailDto>.Failure(AppErrors.General.NotFound);

        var accessibleLessonsResult = await GetLessonsByUnitAsync(lesson.UnitId, userId);
        if (!accessibleLessonsResult.IsSuccess || !accessibleLessonsResult.Value!.Any(l => l.Id == lessonId))
            return Result<LessonDetailDto>.Failure(AppErrors.Authorization.AccessDenied);

        var progress = await _unitOfWork.Repository<LessonProgress>().Query()
            .FirstOrDefaultAsync(lp => lp.UserId == userId && lp.LessonId == lessonId);
            
        var isCompleted = false;

        if (progress != null)
        {
            isCompleted = progress.IsCompleted;
            progress.LastAccessedAt = DateTime.UtcNow;
            _unitOfWork.Repository<LessonProgress>().Update(progress);
        }
        else
        {
            progress = new LessonProgress
            {
                UserId = userId,
                LessonId = lessonId,
                LastAccessedAt = DateTime.UtcNow,
                IsCompleted = false
            };
            await _unitOfWork.Repository<LessonProgress>().AddAsync(progress);
        }

        await _unitOfWork.SaveChangesAsync();

        var detail = new LessonDetailDto
        {
            Id          = lesson.Id,
            UnitId      = lesson.UnitId,
            Title       = lesson.Title,
            Description = lesson.Description,
            VideoUrl    = lesson.VideoUrl,
            LevelId     = lesson.LevelId,
            LevelLabel  = lesson.Level?.Label ?? string.Empty,
            LevelSortOrder = lesson.Level?.SortOrder ?? 0,
            TypeId      = lesson.TypeId,
            TypeLabel   = lesson.Type?.Label ?? string.Empty,
            OrderIndex  = lesson.OrderIndex,
            IsCompleted = isCompleted,
            PdfUrl      = lesson.PdfUrl,
            ExternalLink = lesson.ExternalLink
        };
        
        return Result<LessonDetailDto>.Success(detail);
    }

    public async Task<Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>> GetLastAccessedLessonAsync(Guid userId)
    {
        var last = await _unitOfWork.Repository<LessonProgress>().Query()
            .AsNoTracking()
            .Where(lp => lp.UserId == userId)
            .OrderByDescending(lp => lp.LastAccessedAt)
            .Select(lp => new LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto
            {
                LessonId  = lp.LessonId,
                ModuleId  = lp.Lesson!.Unit!.ModuleId,
                LessonTitle = lp.Lesson.Title
            })
            .FirstOrDefaultAsync();

        if (last == null)
            return Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>.Failure(AppErrors.General.NotFound);

        return Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>.Success(last);
    }

    public async Task<Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>> GetLessonsByLevelAsync(Guid moduleId, Guid userId)
    {
        var userInfo = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.DepartmentId, u.Role })
            .FirstOrDefaultAsync();
            
        if (userInfo == null)
            return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Failure(AppErrors.Authentication.UserNotFound);

        IQueryable<Lesson> accessibleLessonsQuery;

        if (userInfo.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester)
        {
            var hasAccess = await _unitOfWork.Repository<VersionTester>().Query()
                .AnyAsync(tc => tc.TesterId == userId && tc.AssignedModules.Any(am => am.ModuleId == moduleId));

            if (!hasAccess)
                return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Success(new List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>());

            accessibleLessonsQuery = _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => l.Unit!.ModuleId == moduleId);
        }
        else
        {
            var assignments = _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
                .Where(a => a.DepartmentId == userInfo.DepartmentId && a.ModuleId == moduleId);

            accessibleLessonsQuery = _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => l.Unit!.ModuleId == moduleId && assignments.Any(a =>
                    (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                    (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId))
                ));
        }

        var lessonProjections = await accessibleLessonsQuery
            .OrderBy(l => l.Level!.SortOrder)
            .ThenBy(l => l.LevelOrderIndex)
            .ThenBy(l => l.CreatedAt)
            .Select(l => new 
            {
                l.Id,
                l.UnitId,
                l.Title,
                l.Description,
                l.LevelId,
                LevelLabel = l.Level!.Label,
                LevelSortOrder = l.Level!.SortOrder,
                l.TypeId,
                TypeLabel = l.Type!.Label,
                l.OrderIndex,
                l.LevelOrderIndex,
                l.PdfUrl,
                l.ExternalLink
            })
            .ToListAsync();

        if (!lessonProjections.Any())
            return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Success(new List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>());

        var lessonIds = lessonProjections.Select(l => l.Id).ToList();
        var completedLessonIds = await _unitOfWork.Repository<LessonProgress>().Query()
            .AsNoTracking()
            .Where(lp => lp.UserId == userId && lessonIds.Contains(lp.LessonId) && lp.IsCompleted)
            .Select(lp => lp.LessonId)
            .ToHashSetAsync();

        var quizLessonIds = await _context.LessonQuizzes.AsNoTracking()
            .Where(q => lessonIds.Contains(q.LessonId))
            .Select(q => q.LessonId)
            .ToHashSetAsync();

        var summaryLessonIds = await _context.LessonSummaries.AsNoTracking()
            .Where(s => lessonIds.Contains(s.LessonId))
            .Select(s => s.LessonId)
            .ToHashSetAsync();

        var dtos = lessonProjections.Select(l => new LessonDto
        {
            Id          = l.Id,
            UnitId      = l.UnitId,
            Title       = l.Title,
            Description = l.Description,
            LevelId     = l.LevelId,
            LevelLabel  = l.LevelLabel ?? string.Empty,
            TypeId      = l.TypeId,
            TypeLabel   = l.TypeLabel ?? string.Empty,
            OrderIndex  = l.OrderIndex,
            LevelOrderIndex = l.LevelOrderIndex,
            IsCompleted = completedLessonIds.Contains(l.Id),
            HasQuiz     = quizLessonIds.Contains(l.Id),
            HasSummary  = summaryLessonIds.Contains(l.Id),
            PdfUrl      = l.PdfUrl,
            ExternalLink = l.ExternalLink
        }).ToList();

        var grouped = dtos.GroupBy(d => new { d.LevelId, d.LevelLabel })
            .Select(g => new LearnDynamicPro.Application.Dtos.Student.LevelGroupDto
            {
                LevelId = g.Key.LevelId,
                LevelLabel = g.Key.LevelLabel,
                SortOrder = lessonProjections.FirstOrDefault(l => l.LevelId == g.Key.LevelId)?.LevelSortOrder ?? 0,
                TotalLessons = g.Count(),
                Completed = g.Count(l => l.IsCompleted),
                Lessons = g.ToList()
            })
            .OrderBy(g => g.SortOrder)
            .ToList();

        return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Success(grouped);
    }

    public async Task<Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>> GetUnifiedStudentCurriculumAsync(Guid userId)
    {
        var userInfo = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.DepartmentId, u.Role })
            .FirstOrDefaultAsync();
            
        if (userInfo == null)
            return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Failure(AppErrors.Authentication.UserNotFound);

        IQueryable<Lesson> accessibleLessonsQuery;

        if (userInfo.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester)
        {
            var assignedModuleIds = await _unitOfWork.Repository<VersionTester>().Query()
                .AsNoTracking()
                .Where(tc => tc.TesterId == userId)
                .SelectMany(tc => tc.AssignedModules)
                .Select(am => am.ModuleId)
                .ToListAsync();

            accessibleLessonsQuery = _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => assignedModuleIds.Contains(l.Unit!.ModuleId));
        }
        else
        {
            var assignments = _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
                .Where(a => a.DepartmentId == userInfo.DepartmentId);

            accessibleLessonsQuery = _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => assignments.Any(a =>
                    a.ModuleId == l.Unit!.ModuleId &&
                    (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                    (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId))
                ));
        }

        var lessonProjections = await accessibleLessonsQuery
            .Select(l => new 
            {
                l.Id,
                l.UnitId,
                ModuleId = l.Unit!.ModuleId,
                l.Title,
                l.Description,
                l.LevelId,
                LevelLabel = l.Level!.Label,
                LevelSortOrder = l.Level.SortOrder,
                l.TypeId,
                TypeLabel = l.Type!.Label,
                l.OrderIndex,
                l.LevelOrderIndex,
                l.PdfUrl,
                l.ExternalLink
            })
            .ToListAsync();

        if (!lessonProjections.Any())
            return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Success(new List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>());

        var lessonIds = lessonProjections.Select(l => l.Id).ToList();
        var completedLessonIds = await _unitOfWork.Repository<LessonProgress>().Query()
            .AsNoTracking()
            .Where(lp => lp.UserId == userId && lessonIds.Contains(lp.LessonId) && lp.IsCompleted)
            .Select(lp => lp.LessonId)
            .ToHashSetAsync();

        var quizLessonIds = await _context.LessonQuizzes.AsNoTracking()
            .Where(q => lessonIds.Contains(q.LessonId))
            .Select(q => q.LessonId)
            .ToHashSetAsync();

        var summaryLessonIds = await _context.LessonSummaries.AsNoTracking()
            .Where(s => lessonIds.Contains(s.LessonId))
            .Select(s => s.LessonId)
            .ToHashSetAsync();

        var dtos = lessonProjections.Select(l => new LessonDto
        {
            Id          = l.Id,
            UnitId      = l.UnitId,
            Title       = l.Title,
            Description = l.Description,
            LevelId     = l.LevelId,
            LevelLabel  = l.LevelLabel ?? string.Empty,
            TypeId      = l.TypeId,
            TypeLabel   = l.TypeLabel ?? string.Empty,
            OrderIndex  = l.OrderIndex,
            LevelOrderIndex = l.LevelOrderIndex,
            IsCompleted = completedLessonIds.Contains(l.Id),
            HasQuiz     = quizLessonIds.Contains(l.Id),
            HasSummary  = summaryLessonIds.Contains(l.Id),
            PdfUrl      = l.PdfUrl,
            ExternalLink = l.ExternalLink
        }).ToList();

        var grouped = dtos.GroupBy(d => new { d.LevelId, d.LevelLabel })
            .Select(g => new LearnDynamicPro.Application.Dtos.Student.LevelGroupDto
            {
                LevelId = g.Key.LevelId,
                LevelLabel = g.Key.LevelLabel,
                SortOrder = lessonProjections.FirstOrDefault(l => l.LevelId == g.Key.LevelId)?.LevelSortOrder ?? 0,
                TotalLessons = g.Count(),
                Completed = g.Count(l => l.IsCompleted),
                Lessons = g.OrderBy(l => l.LevelOrderIndex).ToList()
            })
            .OrderBy(g => g.SortOrder)
            .ToList();

        return Result<List<LearnDynamicPro.Application.Dtos.Student.LevelGroupDto>>.Success(grouped);
    }

    public async Task<Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>> GetNextLessonToLearnAsync(Guid userId)
    {
        var unifiedCurriculumResult = await GetUnifiedStudentCurriculumAsync(userId);
        if (!unifiedCurriculumResult.IsSuccess)
            return Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>.Failure(unifiedCurriculumResult.Error);
            
        var allLevels = unifiedCurriculumResult.Value;
        if (allLevels == null || !allLevels.Any())
            return Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>.Failure(AppErrors.General.NotFound);
            
        // Find the first uncompleted lesson across all levels
        foreach (var level in allLevels)
        {
            var nextLesson = level.Lessons.FirstOrDefault(l => !l.IsCompleted);
            if (nextLesson != null)
            {
                // We need to fetch the ModuleId since it's not in LessonDto, but wait, LessonDto has UnitId. Let's just return a generic DTO or query ModuleId.
                // We can query ModuleId from DB quickly for this single lesson.
                var moduleId = await _unitOfWork.Repository<Lesson>().Query()
                    .AsNoTracking()
                    .Where(l => l.Id == nextLesson.Id)
                    .Select(l => l.Unit!.ModuleId)
                    .FirstOrDefaultAsync();

                return Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>.Success(new LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto
                {
                    LessonId = nextLesson.Id,
                    ModuleId = moduleId,
                    LessonTitle = nextLesson.Title
                });
            }
        }
        
        // If all are completed, return the very last lesson in the curriculum
        var lastLevel = allLevels.Last();
        var lastLesson = lastLevel.Lessons.Last();
        
        var lastModuleId = await _unitOfWork.Repository<Lesson>().Query()
            .AsNoTracking()
            .Where(l => l.Id == lastLesson.Id)
            .Select(l => l.Unit!.ModuleId)
            .FirstOrDefaultAsync();

        return Result<LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto>.Success(new LearnDynamicPro.Application.Dtos.Student.LastAccessedLessonDto
        {
            LessonId = lastLesson.Id,
            ModuleId = lastModuleId,
            LessonTitle = lastLesson.Title
        });
    }

    public async Task<Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonQuizDto>> GetLessonQuizAsync(Guid lessonId, Guid userId)
    {
        // 1. Validate Access using existing business logic
        var detailResult = await GetLessonDetailAsync(lessonId, userId);
        if (!detailResult.IsSuccess)
            return Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonQuizDto>.Failure(detailResult.Error);

        // 2. Fetch Quiz from SQL Server (NO HTTP call to Python)
        var quiz = await _context.LessonQuizzes.AsNoTracking().FirstOrDefaultAsync(q => q.LessonId == lessonId);
        if (quiz == null)
            return Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonQuizDto>.Failure(AppErrors.General.NotFound);

        // 3. Map to DTO, explicitly omitting CorrectAnswerId and Explanation
        var dto = new LearnDynamicPro.Application.Dtos.Student.StudentLessonQuizDto
        {
            LessonId = quiz.LessonId,
            Questions = quiz.Questions.Select(q => new LearnDynamicPro.Application.Dtos.Student.StudentQuizQuestionDto
            {
                QuestionNumber = q.QuestionNumber,
                QuestionText = q.QuestionText,
                Options = q.Options.Select(o => new LearnDynamicPro.Application.Dtos.Student.StudentQuizOptionDto
                {
                    OptionId = o.OptionId,
                    Text = o.Text
                }).ToList()
            }).ToList()
        };

        return Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonQuizDto>.Success(dto);
    }

    public async Task<Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonSummaryDto>> GetLessonSummaryAsync(Guid lessonId, Guid userId)
    {
        // 1. Validate Access
        var detailResult = await GetLessonDetailAsync(lessonId, userId);
        if (!detailResult.IsSuccess)
            return Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonSummaryDto>.Failure(detailResult.Error);

        // 2. Fetch Summary from SQL Server
        var summary = await _context.LessonSummaries.AsNoTracking().FirstOrDefaultAsync(s => s.LessonId == lessonId);
        if (summary == null)
            return Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonSummaryDto>.Failure(AppErrors.General.NotFound);

        // 3. Map to DTO
        var dto = new LearnDynamicPro.Application.Dtos.Student.StudentLessonSummaryDto
        {
            LessonId = summary.LessonId,
            Overview = summary.Overview,
            Topics = summary.Topics.Select(t => new LearnDynamicPro.Application.Dtos.Student.StudentSummaryTopicDto
            {
                TopicName = t.TopicName,
                Explanation = t.Explanation,
                KeyPoints = t.KeyPoints.ToList()
            }).ToList()
        };

        return Result<LearnDynamicPro.Application.Dtos.Student.StudentLessonSummaryDto>.Success(dto);
    }

    public async Task<Result<StudentQuizStateDto>> GetQuizStateAsync(Guid lessonId, Guid userId)
    {
        // 1. Validate Access
        var detailResult = await GetLessonDetailAsync(lessonId, userId);
        if (!detailResult.IsSuccess)
            return Result<StudentQuizStateDto>.Failure(detailResult.Error);

        // 2. Fetch Quiz to know total questions
        var quiz = await _context.LessonQuizzes.AsNoTracking().FirstOrDefaultAsync(q => q.LessonId == lessonId);
        if (quiz == null)
            return Result<StudentQuizStateDto>.Failure(AppErrors.General.NotFound);

        // 3. Fetch Student's existing Progress
        var progress = await _context.StudentQuizProgresses
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (progress == null)
        {
            return Result<StudentQuizStateDto>.Success(new StudentQuizStateDto
            {
                LessonId = lessonId,
                TotalQuestions = quiz.Questions.Count,
                AnsweredCount = 0,
                CorrectCount = 0,
                ScorePercentage = 0,
                IsCompleted = false,
                CompletedAt = null,
                AnsweredQuestions = new List<QuestionEvaluationResultDto>()
            });
        }

        var dto = new StudentQuizStateDto
        {
            LessonId = lessonId,
            TotalQuestions = quiz.Questions.Count,
            AnsweredCount = progress.Answers.Count,
            CorrectCount = progress.CorrectCount,
            ScorePercentage = progress.ScorePercentage,
            IsCompleted = progress.IsCompleted,
            CompletedAt = progress.CompletedAt,
            AnsweredQuestions = progress.Answers.Select(a => new QuestionEvaluationResultDto
            {
                QuestionNumber = a.QuestionNumber,
                SelectedOptionId = a.SelectedOptionId,
                IsCorrect = a.IsCorrect,
                CorrectAnswerId = a.CorrectAnswerId,
                Explanation = a.Explanation
            }).OrderBy(a => a.QuestionNumber).ToList()
        };

        return Result<StudentQuizStateDto>.Success(dto);
    }

    public async Task<Result<QuestionEvaluationResultDto>> CheckQuizAnswerAsync(Guid lessonId, CheckQuizAnswerRequest request, Guid userId)
    {
        // 1. Validate Access
        var detailResult = await GetLessonDetailAsync(lessonId, userId);
        if (!detailResult.IsSuccess)
            return Result<QuestionEvaluationResultDto>.Failure(detailResult.Error);

        // 2. Fetch Quiz
        var quiz = await _context.LessonQuizzes.AsNoTracking().FirstOrDefaultAsync(q => q.LessonId == lessonId);
        if (quiz == null)
            return Result<QuestionEvaluationResultDto>.Failure(AppErrors.General.NotFound);

        // 3. Find Question
        var question = quiz.Questions.FirstOrDefault(q => q.QuestionNumber == request.QuestionNumber);
        if (question == null)
            return Result<QuestionEvaluationResultDto>.Failure(AppErrors.General.NotFound);

        // 4. Instant Evaluation
        bool isCorrect = string.Equals(request.SelectedOptionId, question.CorrectAnswerId, StringComparison.OrdinalIgnoreCase);

        // 5. Retrieve or Create Student Progress Record (Tracking)
        var progress = await _context.StudentQuizProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (progress == null)
        {
            progress = new StudentQuizProgress
            {
                UserId = userId,
                LessonId = lessonId,
                TotalQuestions = quiz.Questions.Count,
                CorrectCount = 0,
                ScorePercentage = 0,
                IsCompleted = false,
                LastAccessedAt = DateTime.UtcNow
            };
            _context.StudentQuizProgresses.Add(progress);
        }

        // 6. Update Answer State
        var existingAnswer = progress.Answers.FirstOrDefault(a => a.QuestionNumber == request.QuestionNumber);
        if (existingAnswer != null)
        {
            existingAnswer.SelectedOptionId = request.SelectedOptionId;
            existingAnswer.IsCorrect = isCorrect;
            existingAnswer.CorrectAnswerId = question.CorrectAnswerId;
            existingAnswer.Explanation = question.Explanation;
            existingAnswer.AnsweredAt = DateTime.UtcNow;
        }
        else
        {
            progress.Answers.Add(new StudentQuizAnswerState
            {
                QuestionNumber = request.QuestionNumber,
                SelectedOptionId = request.SelectedOptionId,
                IsCorrect = isCorrect,
                CorrectAnswerId = question.CorrectAnswerId,
                Explanation = question.Explanation,
                AnsweredAt = DateTime.UtcNow
            });
        }

        // 7. Update Aggregates
        progress.TotalQuestions = quiz.Questions.Count;
        progress.CorrectCount = progress.Answers.Count(a => a.IsCorrect);
        progress.ScorePercentage = progress.TotalQuestions > 0 ? Math.Round(progress.CorrectCount * 100.0 / progress.TotalQuestions, 1) : 0;
        progress.LastAccessedAt = DateTime.UtcNow;

        // Auto-mark completed if all questions are answered
        if (progress.Answers.Count >= quiz.Questions.Count && !progress.IsCompleted)
        {
            progress.IsCompleted = true;
            progress.CompletedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        var resultDto = new QuestionEvaluationResultDto
        {
            QuestionNumber = request.QuestionNumber,
            SelectedOptionId = request.SelectedOptionId,
            IsCorrect = isCorrect,
            CorrectAnswerId = question.CorrectAnswerId,
            Explanation = question.Explanation
        };

        return Result<QuestionEvaluationResultDto>.Success(resultDto);
    }

    public async Task<Result<QuizSubmissionResultDto>> SubmitQuizAsync(Guid lessonId, SubmitQuizRequest request, Guid userId)
    {
        // 1. Validate Access
        var detailResult = await GetLessonDetailAsync(lessonId, userId);
        if (!detailResult.IsSuccess)
            return Result<QuizSubmissionResultDto>.Failure(detailResult.Error);

        // 2. Fetch Quiz
        var quiz = await _context.LessonQuizzes.AsNoTracking().FirstOrDefaultAsync(q => q.LessonId == lessonId);
        if (quiz == null)
            return Result<QuizSubmissionResultDto>.Failure(AppErrors.General.NotFound);

        // 3. Fetch or Create Progress
        var progress = await _context.StudentQuizProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (progress == null)
        {
            progress = new StudentQuizProgress
            {
                UserId = userId,
                LessonId = lessonId,
                TotalQuestions = quiz.Questions.Count,
                CorrectCount = 0,
                ScorePercentage = 0,
                IsCompleted = false,
                LastAccessedAt = DateTime.UtcNow
            };
            _context.StudentQuizProgresses.Add(progress);
        }

        // 4. If batch answers provided, evaluate them
        if (request.Answers != null && request.Answers.Count > 0)
        {
            foreach (var ans in request.Answers)
            {
                var q = quiz.Questions.FirstOrDefault(x => x.QuestionNumber == ans.QuestionNumber);
                if (q == null) continue;

                bool isCorrect = string.Equals(ans.SelectedOptionId, q.CorrectAnswerId, StringComparison.OrdinalIgnoreCase);
                var existing = progress.Answers.FirstOrDefault(a => a.QuestionNumber == ans.QuestionNumber);
                if (existing != null)
                {
                    existing.SelectedOptionId = ans.SelectedOptionId;
                    existing.IsCorrect = isCorrect;
                    existing.CorrectAnswerId = q.CorrectAnswerId;
                    existing.Explanation = q.Explanation;
                    existing.AnsweredAt = DateTime.UtcNow;
                }
                else
                {
                    progress.Answers.Add(new StudentQuizAnswerState
                    {
                        QuestionNumber = ans.QuestionNumber,
                        SelectedOptionId = ans.SelectedOptionId,
                        IsCorrect = isCorrect,
                        CorrectAnswerId = q.CorrectAnswerId,
                        Explanation = q.Explanation,
                        AnsweredAt = DateTime.UtcNow
                    });
                }
            }
        }

        // 5. Finalize Progress
        progress.TotalQuestions = quiz.Questions.Count;
        progress.CorrectCount = progress.Answers.Count(a => a.IsCorrect);
        progress.ScorePercentage = progress.TotalQuestions > 0 ? Math.Round(progress.CorrectCount * 100.0 / progress.TotalQuestions, 1) : 0;
        progress.IsCompleted = true;
        progress.CompletedAt = DateTime.UtcNow;
        progress.LastAccessedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var resultDto = new QuizSubmissionResultDto
        {
            TotalQuestions = progress.TotalQuestions,
            CorrectCount = progress.CorrectCount,
            ScorePercentage = progress.ScorePercentage,
            Passed = progress.ScorePercentage >= 50.0,
            Results = progress.Answers.Select(a => new QuestionEvaluationResultDto
            {
                QuestionNumber = a.QuestionNumber,
                SelectedOptionId = a.SelectedOptionId,
                IsCorrect = a.IsCorrect,
                CorrectAnswerId = a.CorrectAnswerId,
                Explanation = a.Explanation
            }).OrderBy(r => r.QuestionNumber).ToList()
        };

        return Result<QuizSubmissionResultDto>.Success(resultDto);
    }

    public async Task<Result<bool>> ResetQuizAsync(Guid lessonId, Guid userId)
    {
        // 1. Validate Access
        var detailResult = await GetLessonDetailAsync(lessonId, userId);
        if (!detailResult.IsSuccess)
            return Result<bool>.Failure(detailResult.Error);

        // 2. Fetch Progress
        var progress = await _context.StudentQuizProgresses
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (progress != null)
        {
            _context.StudentQuizProgresses.Remove(progress);
            await _context.SaveChangesAsync();
        }

        return Result<bool>.Success(true);
    }
}
