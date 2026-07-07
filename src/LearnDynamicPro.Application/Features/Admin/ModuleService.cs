using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
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

    public async Task<ModuleDto> CreateModuleAsync(CreateModuleRequest request)
    {
        var module = new Module { Name = request.Name, Description = request.Description };
        _context.Modules.Add(module);
        await _context.SaveChangesAsync(default);

        return new ModuleDto { Id = module.Id, Name = module.Name, Description = module.Description };
    }

    public async Task<ModuleDto> UpdateModuleAsync(Guid id, UpdateModuleRequest request)
    {
        var module = await _context.Modules.FindAsync(id);
        if (module == null) throw new KeyNotFoundException("Module not found");

        module.Name = request.Name;
        module.Description = request.Description;
        await _context.SaveChangesAsync(default);

        return new ModuleDto { Id = module.Id, Name = module.Name, Description = module.Description };
    }

    public async Task DeleteModuleAsync(Guid id)
    {
        var module = await _context.Modules.FindAsync(id);
        if (module != null)
        {
            _context.Modules.Remove(module);
            await _context.SaveChangesAsync(default);
        }
    }

    public async Task<List<ModuleDto>> GetAllModulesAsync()
    {
        return await _context.Modules
            .AsNoTracking()
            .Select(m => new ModuleDto { Id = m.Id, Name = m.Name, Description = m.Description })
            .ToListAsync();
    }

    public async Task<UnitDto> CreateUnitAsync(CreateUnitRequest request)
    {
        var unit = new Unit { Name = request.Name, ModuleId = request.ModuleId, OrderIndex = request.OrderIndex };
        _context.Units.Add(unit);
        await _context.SaveChangesAsync(default);

        return new UnitDto { Id = unit.Id, Name = unit.Name, ModuleId = unit.ModuleId, OrderIndex = unit.OrderIndex };
    }

    public async Task<UnitDto> UpdateUnitAsync(Guid id, UpdateUnitRequest request)
    {
        var unit = await _context.Units.FindAsync(id);
        if (unit == null) throw new KeyNotFoundException("Unit not found");

        unit.Name = request.Name;
        unit.OrderIndex = request.OrderIndex;
        await _context.SaveChangesAsync(default);

        return new UnitDto { Id = unit.Id, Name = unit.Name, ModuleId = unit.ModuleId, OrderIndex = unit.OrderIndex };
    }

    public async Task DeleteUnitAsync(Guid id)
    {
        var unit = await _context.Units.FindAsync(id);
        if (unit != null)
        {
            _context.Units.Remove(unit);
            await _context.SaveChangesAsync(default);
        }
    }

    public async Task<List<UnitDto>> GetUnitsByModuleAsync(Guid moduleId)
    {
        return await _context.Units
            .AsNoTracking()
            .Where(u => u.ModuleId == moduleId)
            .Select(u => new UnitDto { Id = u.Id, Name = u.Name, ModuleId = u.ModuleId, OrderIndex = u.OrderIndex })
            .ToListAsync();
    }

    public async Task<LessonDto> CreateLessonAsync(CreateLessonRequest request)
    {
        var lesson = new Lesson 
        { 
            Title = request.Title, 
            VideoUrl = request.VideoUrl, 
            UnitId = request.UnitId,
            LevelId = request.LevelId,
            TypeId = request.TypeId,
            OrderIndex = request.OrderIndex
        };
        _context.Lessons.Add(lesson);
        await _context.SaveChangesAsync(default);

        return new LessonDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            TypeId = lesson.TypeId,
            OrderIndex = lesson.OrderIndex 
        };
    }

    public async Task<LessonDto> UpdateLessonAsync(Guid id, UpdateLessonRequest request)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson == null) throw new KeyNotFoundException("Lesson not found");

        lesson.Title = request.Title;
        lesson.VideoUrl = request.VideoUrl;
        lesson.LevelId = request.LevelId;
        lesson.TypeId = request.TypeId;
        lesson.OrderIndex = request.OrderIndex;
        await _context.SaveChangesAsync(default);

        return new LessonDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            TypeId = lesson.TypeId,
            OrderIndex = lesson.OrderIndex 
        };
    }

    public async Task DeleteLessonAsync(Guid id)
    {
        var lesson = await _context.Lessons.FindAsync(id);
        if (lesson != null)
        {
            _context.Lessons.Remove(lesson);
            await _context.SaveChangesAsync(default);
        }
    }

    public async Task<List<LessonDto>> GetLessonsByUnitAsync(Guid unitId)
    {
        return await _context.Lessons
            .AsNoTracking()
            .Where(l => l.UnitId == unitId)
            .Include(l => l.Level)
            .Include(l => l.Type)
            .Select(l => new LessonDto 
            { 
                Id = l.Id, 
                Title = l.Title, 
                UnitId = l.UnitId, 
                LevelId = l.LevelId,
                LevelLabel = l.Level != null ? l.Level.Label : string.Empty,
                TypeId = l.TypeId,
                TypeLabel = l.Type != null ? l.Type.Label : string.Empty,
                OrderIndex = l.OrderIndex 
            })
            .ToListAsync();
    }

    public async Task<LessonDetailDto> GetLessonDetailAsync(Guid lessonId)
    {
        var lesson = await _context.Lessons
            .AsNoTracking()
            .Include(l => l.Level)
            .Include(l => l.Type)
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson == null) throw new KeyNotFoundException("Lesson not found");

        return new LessonDetailDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            VideoUrl = lesson.VideoUrl,
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            LevelLabel = lesson.Level != null ? lesson.Level.Label : string.Empty,
            TypeId = lesson.TypeId,
            TypeLabel = lesson.Type != null ? lesson.Type.Label : string.Empty,
            OrderIndex = lesson.OrderIndex 
        };
    }
}

