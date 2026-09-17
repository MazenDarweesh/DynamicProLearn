using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;

namespace LearnDynamicPro.Application.Features.Admin;

public class ModuleService : IModuleService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IWebhookDispatcher _webhookDispatcher;

    public ModuleService(IUnitOfWork unitOfWork, IWebhookDispatcher webhookDispatcher)
    {
        _unitOfWork = unitOfWork;
        _webhookDispatcher = webhookDispatcher;
    }

    public async Task<Result<ModuleDto>> CreateModuleAsync(CreateModuleRequest request)
    {
        var module = new Module { Name = request.Name, Description = request.Description };
        await _unitOfWork.Repository<Module>().AddAsync(module);
        await _unitOfWork.SaveChangesAsync();

        return Result<ModuleDto>.Success(new ModuleDto { Id = module.Id, Name = module.Name, Description = module.Description });
    }

    public async Task<Result<ModuleDto>> UpdateModuleAsync(Guid id, UpdateModuleRequest request)
    {
        var module = await _unitOfWork.Repository<Module>().GetByIdAsync(id);
        if (module == null) return Result<ModuleDto>.Failure(AppErrors.General.NotFound);

        module.Name = request.Name;
        module.Description = request.Description;
        _unitOfWork.Repository<Module>().Update(module);
        await _unitOfWork.SaveChangesAsync();

        return Result<ModuleDto>.Success(new ModuleDto { Id = module.Id, Name = module.Name, Description = module.Description });
    }

    public async Task<Result> DeleteModuleAsync(Guid id)
    {
        var module = await _unitOfWork.Repository<Module>().GetByIdAsync(id);
        if (module != null)
        {
            var versionTesterModules = await _unitOfWork.Repository<VersionTesterModule>().Query()
                .Where(tcm => tcm.ModuleId == id).ToListAsync();
            foreach (var tcm in versionTesterModules)
                _unitOfWork.Repository<VersionTesterModule>().Remove(tcm);

            _unitOfWork.Repository<Module>().Remove(module);
            await _unitOfWork.SaveChangesAsync();
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<ModuleDto>>> GetAllModulesAsync(int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Module>().Query().AsNoTracking();
        var totalCount = await query.CountAsync();

        var modules = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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
        await _unitOfWork.Repository<Unit>().AddAsync(unit);
        await _unitOfWork.SaveChangesAsync();

        return Result<UnitDto>.Success(new UnitDto { Id = unit.Id, Name = unit.Name, ModuleId = unit.ModuleId, OrderIndex = unit.OrderIndex });
    }

    public async Task<Result<UnitDto>> UpdateUnitAsync(Guid id, UpdateUnitRequest request)
    {
        var unit = await _unitOfWork.Repository<Unit>().GetByIdAsync(id);
        if (unit == null) return Result<UnitDto>.Failure(AppErrors.General.NotFound);

        unit.Name = request.Name;
        unit.OrderIndex = request.OrderIndex;
        _unitOfWork.Repository<Unit>().Update(unit);
        await _unitOfWork.SaveChangesAsync();

        return Result<UnitDto>.Success(new UnitDto { Id = unit.Id, Name = unit.Name, ModuleId = unit.ModuleId, OrderIndex = unit.OrderIndex });
    }

    public async Task<Result> DeleteUnitAsync(Guid id)
    {
        var unit = await _unitOfWork.Repository<Unit>().GetByIdAsync(id);
        if (unit != null)
        {
            _unitOfWork.Repository<Unit>().Remove(unit);
            await _unitOfWork.SaveChangesAsync();
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<UnitDto>>> GetUnitsByModuleAsync(Guid moduleId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Unit>().Query().AsNoTracking().Where(u => u.ModuleId == moduleId);
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
        if (!await _unitOfWork.Repository<LevelOption>().Query().AnyAsync(l => l.Id == levelId))
            levelId = (await _unitOfWork.Repository<LevelOption>().Query().FirstOrDefaultAsync())?.Id ?? levelId;

        var typeId = request.TypeId;
        if (!await _unitOfWork.Repository<TypeOption>().Query().AnyAsync(t => t.Id == typeId))
            typeId = (await _unitOfWork.Repository<TypeOption>().Query().FirstOrDefaultAsync())?.Id ?? typeId;

        var hasVideo = !string.IsNullOrWhiteSpace(request.VideoUrl);
        var lesson = new Lesson 
        { 
            Title = request.Title, 
            VideoUrl = request.VideoUrl, 
            PdfUrl = request.PdfUrl,
            ExternalLink = request.ExternalLink,
            UnitId = request.UnitId,
            LevelId = levelId,
            TypeId = typeId,
            Description = request.Description,
            OrderIndex = request.OrderIndex,
            LevelOrderIndex = request.LevelOrderIndex,
            AiStatus = hasVideo ? LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued : LearnDynamicPro.Domain.Enums.LessonAiStatus.None
        };
        await _unitOfWork.Repository<Lesson>().AddAsync(lesson);
        await _unitOfWork.SaveChangesAsync();

        if (hasVideo)
        {
            _ = _webhookDispatcher.DispatchLessonUpdatedAsync(lesson.Id);
        }

        return Result<LessonDto>.Success(new LessonDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            VideoUrl = lesson.VideoUrl, 
            PdfUrl = lesson.PdfUrl,
            ExternalLink = lesson.ExternalLink,
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            LevelSortOrder = lesson.Level?.SortOrder ?? 0,
            TypeId = lesson.TypeId,
            Description = lesson.Description,
            OrderIndex = lesson.OrderIndex,
            LevelOrderIndex = lesson.LevelOrderIndex,
            AiStatus = lesson.AiStatus.ToString(),
            AiError = lesson.AiError,
            AiChunksCount = lesson.AiChunksCount,
            AiProcessedAt = lesson.AiProcessedAt
        });
    }

    public async Task<Result<LessonDto>> UpdateLessonAsync(Guid id, UpdateLessonRequest request)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().GetByIdAsync(id);
        if (lesson == null) return Result<LessonDto>.Failure(AppErrors.General.NotFound);

        var levelId = request.LevelId;
        if (!await _unitOfWork.Repository<LevelOption>().Query().AnyAsync(l => l.Id == levelId))
            levelId = (await _unitOfWork.Repository<LevelOption>().Query().FirstOrDefaultAsync())?.Id ?? levelId;

        var typeId = request.TypeId;
        if (!await _unitOfWork.Repository<TypeOption>().Query().AnyAsync(t => t.Id == typeId))
            typeId = (await _unitOfWork.Repository<TypeOption>().Query().FirstOrDefaultAsync())?.Id ?? typeId;

        var videoChanged = !string.Equals(lesson.VideoUrl, request.VideoUrl, StringComparison.OrdinalIgnoreCase);
        lesson.Title = request.Title;
        lesson.VideoUrl = request.VideoUrl;
        lesson.PdfUrl = request.PdfUrl;
        lesson.ExternalLink = request.ExternalLink;
        lesson.LevelId = levelId;
        lesson.TypeId = typeId;
        lesson.Description = request.Description;
        lesson.OrderIndex = request.OrderIndex;
        lesson.LevelOrderIndex = request.LevelOrderIndex;
        
        var hasVideo = !string.IsNullOrWhiteSpace(lesson.VideoUrl);
        if (hasVideo && (videoChanged || lesson.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.None || lesson.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.Failed))
        {
            lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued;
            lesson.AiError = null;
        }
        else if (!hasVideo)
        {
            lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.None;
            lesson.AiError = null;
            lesson.AiChunksCount = 0;
        }

        _unitOfWork.Repository<Lesson>().Update(lesson);
        await _unitOfWork.SaveChangesAsync();
        
        if (hasVideo && lesson.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued)
        {
            _ = _webhookDispatcher.DispatchLessonUpdatedAsync(lesson.Id);
        }

        return Result<LessonDto>.Success(new LessonDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            VideoUrl = lesson.VideoUrl, 
            PdfUrl = lesson.PdfUrl,
            ExternalLink = lesson.ExternalLink,
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            LevelSortOrder = lesson.Level?.SortOrder ?? 0,
            TypeId = lesson.TypeId,
            Description = lesson.Description,
            OrderIndex = lesson.OrderIndex,
            LevelOrderIndex = lesson.LevelOrderIndex,
            AiStatus = lesson.AiStatus.ToString(),
            AiError = lesson.AiError,
            AiChunksCount = lesson.AiChunksCount,
            AiProcessedAt = lesson.AiProcessedAt
        });
    }

    public async Task<Result> DeleteLessonAsync(Guid id)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().GetByIdAsync(id);
        if (lesson != null)
        {
            var progresses = await _unitOfWork.Repository<LessonProgress>().Query()
                .Where(lp => lp.LessonId == id).ToListAsync();
            foreach (var p in progresses)
                _unitOfWork.Repository<LessonProgress>().Remove(p);

            _unitOfWork.Repository<Lesson>().Remove(lesson);
            await _unitOfWork.SaveChangesAsync();
            
            _ = _webhookDispatcher.DispatchLessonDeletedAsync(id);
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<LessonDto>>> GetLessonsByUnitAsync(Guid unitId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Lesson>().Query()
            .AsNoTracking()
            .Where(l => l.UnitId == unitId);
            
        var totalCount = await query.CountAsync();

        var lessons = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new LessonDto 
            { 
                Id = l.Id, 
                Title = l.Title, 
                Description = l.Description,
                VideoUrl = l.VideoUrl,
                PdfUrl = l.PdfUrl,
                ExternalLink = l.ExternalLink,
                UnitId = l.UnitId, 
                LevelId = l.LevelId,
                LevelLabel = l.Level != null ? l.Level.Label : string.Empty,
                LevelSortOrder = l.Level != null ? l.Level.SortOrder : 0,
                TypeId = l.TypeId,
                TypeLabel = l.Type != null ? l.Type.Label : string.Empty,
                OrderIndex = l.OrderIndex,
                LevelOrderIndex = l.LevelOrderIndex,
                AiStatus = l.AiStatus.ToString(),
                AiError = l.AiError,
                AiChunksCount = l.AiChunksCount,
                AiProcessedAt = l.AiProcessedAt
            })
            .ToListAsync();
            
        var pagedList = new PagedList<LessonDto>(lessons, totalCount, page, pageSize);
        return Result<PagedList<LessonDto>>.Success(pagedList);
    }

    public async Task<Result<LessonDetailDto>> GetLessonDetailAsync(Guid lessonId)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson == null) return Result<LessonDetailDto>.Failure(AppErrors.General.NotFound);

        return Result<LessonDetailDto>.Success(new LessonDetailDto 
        { 
            Id = lesson.Id, 
            Title = lesson.Title, 
            Description = lesson.Description,
            VideoUrl = lesson.VideoUrl,
            PdfUrl = lesson.PdfUrl,
            ExternalLink = lesson.ExternalLink,
            UnitId = lesson.UnitId, 
            LevelId = lesson.LevelId,
            LevelLabel = lesson.Level != null ? lesson.Level.Label : string.Empty,
            TypeId = lesson.TypeId,
            TypeLabel = lesson.Type != null ? lesson.Type.Label : string.Empty,
            OrderIndex = lesson.OrderIndex,
            LevelOrderIndex = lesson.LevelOrderIndex,
            AiStatus = lesson.AiStatus.ToString(),
            AiError = lesson.AiError,
            AiChunksCount = lesson.AiChunksCount,
            AiProcessedAt = lesson.AiProcessedAt
        });
    }

    public async Task<Result<bool>> RetryLessonAiIngestAsync(Guid lessonId)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().GetByIdAsync(lessonId);
        if (lesson == null) return Result<bool>.Failure(AppErrors.General.NotFound);

        if (string.IsNullOrWhiteSpace(lesson.VideoUrl))
        {
            return Result<bool>.Failure("لا يمكن بدء معالجة الذكاء الاصطناعي لدرس لا يحتوي على رابط فيديو.");
        }

        lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued;
        lesson.AiError = null;
        lesson.AiRetryCount++;

        _unitOfWork.Repository<Lesson>().Update(lesson);
        await _unitOfWork.SaveChangesAsync();

        _ = _webhookDispatcher.DispatchLessonUpdatedAsync(lesson.Id);

        return Result<bool>.Success(true);
    }
}

