using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Student;

public class StudentService : IStudentService
{
    private readonly IApplicationDbContext _context;

    public StudentService(IApplicationDbContext context)
    {
        _context = context;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetAssignedModules
    // Logic: find the student → get their department → get assignments for that
    //        department → project to ModuleDto (distinct, because a module can
    //        appear multiple times with different Level/Type combos).
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<ModuleDto>> GetAssignedModulesAsync(Guid userId)
    {
        // Resolve the student's department
        var departmentId = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.DepartmentId)
            .FirstOrDefaultAsync();

        if (departmentId == Guid.Empty)
            throw new KeyNotFoundException($"User {userId} not found.");

        // Fetch distinct modules assigned to the department
        var modules = await _context.DepartmentModuleAssignments
            .AsNoTracking()
            .Where(a => a.DepartmentId == departmentId)
            .Select(a => new ModuleDto
            {
                Id          = a.Module!.Id,
                Name        = a.Module.Name,
                Description = a.Module.Description
            })
            .Distinct()
            .OrderBy(m => m.Name)
            .ToListAsync();

        return modules;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetUnitsByModule — no filtering here; units are structural containers
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<List<UnitDto>> GetUnitsByModuleAsync(Guid moduleId)
    {
        var units = await _context.Units
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

        return units;
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
    public async Task<List<LessonDto>> GetLessonsByUnitAsync(Guid unitId, Guid userId)
    {
        // Step 1 — resolve department and the module that owns this unit
        var userInfo = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new { u.DepartmentId })
            .FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException($"User {userId} not found.");

        var moduleId = await _context.Units
            .AsNoTracking()
            .Where(u => u.Id == unitId)
            .Select(u => u.ModuleId)
            .FirstOrDefaultAsync();

        // Step 2 — IQueryable for assignment filters
        var assignments = _context.DepartmentModuleAssignments
            .Where(a => a.DepartmentId == userInfo.DepartmentId && a.ModuleId == moduleId);

        // Step 3 — Apply Intersection Filter in Database using Any (EXISTS)
        var accessibleLessonsQuery = _context.Lessons
            .AsNoTracking()
            .Include(l => l.Level)
            .Include(l => l.Type)
            .Where(l => l.UnitId == unitId && assignments.Any(a =>
                (a.LevelId == null || a.LevelId == l.LevelId) &&
                (a.TypeId  == null || a.TypeId  == l.TypeId)
            ));

        // Step 4 — Fetch the filtered lessons and completed IDs
        var lessons = await accessibleLessonsQuery
            .OrderBy(l => l.OrderIndex)
            .ToListAsync();

        if (!lessons.Any())
            return new List<LessonDto>();

        var lessonIds = lessons.Select(l => l.Id).ToList();
        var completedLessonIds = await _context.LessonProgresses
            .AsNoTracking()
            .Where(lp => lp.UserId == userId && lessonIds.Contains(lp.LessonId) && lp.IsCompleted)
            .Select(lp => lp.LessonId)
            .ToHashSetAsync();

        return lessons.Select(l => new LessonDto
        {
            Id          = l.Id,
            UnitId      = l.UnitId,
            Title       = l.Title,
            LevelId     = l.LevelId,
            LevelLabel  = l.Level?.Label ?? string.Empty,
            TypeId      = l.TypeId,
            TypeLabel   = l.Type?.Label ?? string.Empty,
            OrderIndex  = l.OrderIndex,
            IsCompleted = completedLessonIds.Contains(l.Id)
        }).ToList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GetLessonDetail — single lesson with VideoUrl (only after access check)
    // ─────────────────────────────────────────────────────────────────────────
    public async Task<LessonDetailDto> GetLessonDetailAsync(Guid lessonId, Guid userId)
    {
        var lesson = await _context.Lessons
            .AsNoTracking()
            .Include(l => l.Level)
            .Include(l => l.Type)
            .FirstOrDefaultAsync(l => l.Id == lessonId)
            ?? throw new KeyNotFoundException($"Lesson {lessonId} not found.");

        // Verify the student's department actually has access to this lesson
        var accessibleLessons = await GetLessonsByUnitAsync(lesson.UnitId, userId);
        if (!accessibleLessons.Any(l => l.Id == lessonId))
            throw new UnauthorizedAccessException("You do not have access to this lesson.");

        var isCompleted = await _context.LessonProgresses
            .AsNoTracking()
            .AnyAsync(lp => lp.UserId == userId && lp.LessonId == lessonId && lp.IsCompleted);

        return new LessonDetailDto
        {
            Id          = lesson.Id,
            UnitId      = lesson.UnitId,
            Title       = lesson.Title,
            VideoUrl    = lesson.VideoUrl,
            LevelId     = lesson.LevelId,
            LevelLabel  = lesson.Level?.Label ?? string.Empty,
            TypeId      = lesson.TypeId,
            TypeLabel   = lesson.Type?.Label ?? string.Empty,
            OrderIndex  = lesson.OrderIndex,
            IsCompleted = isCompleted
        };
    }
}
