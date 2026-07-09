using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Admin;

public class ModuleService : IModuleService
{
    private readonly IApplicationDbContext _context;

    public ModuleService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<ModuleDto>> CreateModuleAsync(CreateModuleRequest request)
    {
        var module = new Module { Name = request.Name, Description = request.Description };
        _context.Modules.Add(module);
        await _context.SaveChangesAsync(default);

        return Result<ModuleDto>.Success(new ModuleDto { Id = module.Id, Name = module.Name, Description = module.Description });
    }

    public async Task<Result<ModuleDto>> UpdateModuleAsync(Guid id, UpdateModuleRequest request)
    {
        var module = await _context.Modules.FindAsync(id);
        if (module == null) return Result<ModuleDto>.Failure(AppErrors.General.NotFound);

        module.Name = request.Name;
        module.Description = request.Description;
        await _context.SaveChangesAsync(default);

        return Result<ModuleDto>.Success(new ModuleDto { Id = module.Id, Name = module.Name, Description = module.Description });
    }

    public async Task<Result> DeleteModuleAsync(Guid id)
    {
        var module = await _context.Modules.FindAsync(id);
        if (module != null)
        {
            _context.Modules.Remove(module);
            await _context.SaveChangesAsync(default);
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<ModuleDto>>> GetAllModulesAsync(int page = 1, int pageSize = 10)
    {
        var query = _context.Modules.AsNoTracking();
        var totalCount = await query.CountAsync();

        var modules = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(m => m.Assignments)
                .ThenInclude(a => a.Department)
                    .ThenInclude(d => d.Company)
            .Select(m => new ModuleDto { 
                Id = m.Id, 
                Name = m.Name, 
                Description = m.Description,
                AssignedDepartments = m.Assignments
                    .Where(a => a.Department != null && a.Department.Company != null)
                    .Select(a => $"{a.Department!.Name} ({a.Department.Company!.Name})")
                    .ToList()
            })
            .ToListAsync();
            
        var pagedList = new PagedList<ModuleDto>(modules, totalCount, page, pageSize);
        return Result<PagedList<ModuleDto>>.Success(pagedList);
    }

    public async Task<Result<UnitDto>> CreateUnitAsync(CreateUnitRequest request)
    {
        var unit = new Unit { Name = request.Name, ModuleId = request.ModuleId, OrderIndex = request.OrderIndex };
        _context.Units.Add(unit);
        await _context.SaveChangesAsync(default);

        return Result<UnitDto>.Success(new UnitDto { Id = unit.Id, Name = unit.Name, ModuleId = unit.ModuleId, OrderIndex = unit.OrderIndex });
    }

    public async Task<Result<UnitDto>> UpdateUnitAsync(Guid id, UpdateUnitRequest request)
    {
        var unit = await _context.Units.FindAsync(id);
        if (unit == null) return Result<UnitDto>.Failure(AppErrors.General.NotFound);

        unit.Name = request.Name;
        unit.OrderIndex = request.OrderIndex;
        await _context.SaveChangesAsync(default);

        return Result<UnitDto>.Success(new UnitDto { Id = unit.Id, Name = unit.Name, ModuleId = unit.ModuleId, OrderIndex = unit.OrderIndex });
    }

    public async Task<Result> DeleteUnitAsync(Guid id)
    {
        var unit = await _context.Units.FindAsync(id);
        if (unit != null)
        {
            _context.Units.Remove(unit);
            await _context.SaveChangesAsync(default);
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<UnitDto>>> GetUnitsByModuleAsync(Guid moduleId, int page = 1, int pageSize = 10)
    {
        var query = _context.Units.AsNoTracking().Where(u => u.ModuleId == moduleId);
        var totalCount = await query.CountAsync();

        var units = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UnitDto { Id = u.Id, Name = u.Name, ModuleId = u.ModuleId, OrderIndex = u.OrderIndex })
            .ToListAsync();
            
        var pagedList = new PagedList<UnitDto>(units, totalCount, page, pageSize);
        return Result<PagedList<UnitDto>>.Success(pagedList);
    }

    public async Task<Result<LessonDto>> CreateLessonAsync(CreateLessonRequest request)
    {
        var levelId = request.LevelId;
        if (!await _context.LevelOptions.AnyAsync(l => l.Id == levelId))
            levelId = (await _context.LevelOptions.FirstOrDefaultAsync())?.Id ?? levelId;

        var typeId = request.TypeId;
        if (!await _context.TypeOptions.AnyAsync(t => t.Id == typeId))
            typeId = (await _context.TypeOptions.FirstOrDefaultAsync())?.Id ?? typeId;

        var lesson = new Lesson 
        { 
            Title = request.Title, 
            VideoUrl = request.VideoUrl, 
            UnitId = request.UnitId,
            LevelId = levelId,
            TypeId = typeId,
            Description = request.Description,
            OrderIndex = request.OrderIndex
        };
        _context.Lessons.Add(lesson);
        await _context.SaveChangesAsync(default);

        return Result<LessonDto>.Success(new LessonDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            TypeId = lesson.TypeId,
            Description = lesson.Description,
            OrderIndex = lesson.OrderIndex 
        });
    }

    public async Task<Result<LessonDto>> UpdateLessonAsync(Guid id, UpdateLessonRequest request)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson == null) return Result<LessonDto>.Failure(AppErrors.General.NotFound);

        var levelId = request.LevelId;
        if (!await _context.LevelOptions.AnyAsync(l => l.Id == levelId))
            levelId = (await _context.LevelOptions.FirstOrDefaultAsync())?.Id ?? levelId;

        var typeId = request.TypeId;
        if (!await _context.TypeOptions.AnyAsync(t => t.Id == typeId))
            typeId = (await _context.TypeOptions.FirstOrDefaultAsync())?.Id ?? typeId;

        lesson.Title = request.Title;
        lesson.VideoUrl = request.VideoUrl;
        lesson.LevelId = levelId;
        lesson.TypeId = typeId;
        lesson.Description = request.Description;
        lesson.OrderIndex = request.OrderIndex;
        await _context.SaveChangesAsync(default);

        return Result<LessonDto>.Success(new LessonDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            TypeId = lesson.TypeId,
            Description = lesson.Description,
            OrderIndex = lesson.OrderIndex 
        });
    }

    public async Task<Result> DeleteLessonAsync(Guid id)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson != null)
        {
            _context.Lessons.Remove(lesson);
            await _context.SaveChangesAsync(default);
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<LessonDto>>> GetLessonsByUnitAsync(Guid unitId, int page = 1, int pageSize = 10)
    {
        var query = _context.Lessons
            .AsNoTracking()
            .Where(l => l.UnitId == unitId)
            .Include(l => l.Level)
            .Include(l => l.Type);
            
        var totalCount = await query.CountAsync();

        var lessons = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new LessonDto 
            { 
                Id = l.Id, 
                Title = l.Title, 
                Description = l.Description,
                UnitId = l.UnitId, 
                LevelId = l.LevelId,
                LevelLabel = l.Level != null ? l.Level.Label : string.Empty,
                TypeId = l.TypeId,
                TypeLabel = l.Type != null ? l.Type.Label : string.Empty,
                OrderIndex = l.OrderIndex 
            })
            .ToListAsync();
            
        var pagedList = new PagedList<LessonDto>(lessons, totalCount, page, pageSize);
        return Result<PagedList<LessonDto>>.Success(pagedList);
    }

    public async Task<Result<LessonDetailDto>> GetLessonDetailAsync(Guid lessonId)
    {
        var lesson = await _context.Lessons
            .AsNoTracking()
            .Include(l => l.Level)
            .Include(l => l.Type)
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson == null) return Result<LessonDetailDto>.Failure(AppErrors.General.NotFound);

        return Result<LessonDetailDto>.Success(new LessonDetailDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            Description = lesson.Description,
            VideoUrl = lesson.VideoUrl,
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            LevelLabel = lesson.Level != null ? lesson.Level.Label : string.Empty,
            TypeId = lesson.TypeId,
            TypeLabel = lesson.Type != null ? lesson.Type.Label : string.Empty,
            OrderIndex = lesson.OrderIndex 
        });
    }
}

