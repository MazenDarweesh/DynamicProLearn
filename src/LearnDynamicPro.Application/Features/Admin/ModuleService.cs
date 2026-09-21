using System.Text.RegularExpressions;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
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

        var unit = await _unitOfWork.Repository<Unit>().GetByIdAsync(request.UnitId);
        var moduleId = unit?.ModuleId;

        var levelOrderIndex = request.LevelOrderIndex;
        if (levelOrderIndex <= 0)
        {
            var maxLevelOrder = await _unitOfWork.Repository<Lesson>().Query()
                .Where(l => l.LevelId == levelId && (moduleId == null || l.Unit!.ModuleId == moduleId))
                .MaxAsync(l => (int?)l.LevelOrderIndex) ?? 0;

            levelOrderIndex = maxLevelOrder + 1;
        }

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
            LevelOrderIndex = levelOrderIndex,
            AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.None
        };
        await _unitOfWork.Repository<Lesson>().AddAsync(lesson);
        await _unitOfWork.SaveChangesAsync();

        if (hasVideo)
        {
            var linked = await TryLinkExistingProcessedLessonAsync(lesson, moduleId);
            if (!linked)
            {
                lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued;
                _unitOfWork.Repository<Lesson>().Update(lesson);
                await _unitOfWork.SaveChangesAsync();

                _ = _webhookDispatcher.DispatchLessonUpdatedAsync(lesson.Id, lesson.VideoUrl, moduleId, lesson.UnitId);
            }
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
        var unit = await _unitOfWork.Repository<Unit>().GetByIdAsync(lesson.UnitId);
        var moduleId = unit?.ModuleId;

        var levelOrderIndex = request.LevelOrderIndex;
        if (levelOrderIndex <= 0)
        {
            var maxLevelOrder = await _unitOfWork.Repository<Lesson>().Query()
                .Where(l => l.LevelId == levelId && l.Id != id && (moduleId == null || l.Unit!.ModuleId == moduleId))
                .MaxAsync(l => (int?)l.LevelOrderIndex) ?? 0;

            levelOrderIndex = maxLevelOrder + 1;
        }

        lesson.OrderIndex = request.OrderIndex;
        lesson.LevelOrderIndex = levelOrderIndex;
        
        var hasVideo = !string.IsNullOrWhiteSpace(lesson.VideoUrl);
        var shouldTriggerAi = hasVideo && (videoChanged || lesson.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.None || lesson.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.Failed);

        if (!hasVideo)
        {
            lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.None;
            lesson.AiError = null;
            lesson.AiChunksCount = 0;
            _unitOfWork.Repository<Lesson>().Update(lesson);
            await _unitOfWork.SaveChangesAsync();
        }
        else if (shouldTriggerAi)
        {
            _unitOfWork.Repository<Lesson>().Update(lesson);
            await _unitOfWork.SaveChangesAsync();

            var linked = await TryLinkExistingProcessedLessonAsync(lesson, moduleId);
            if (!linked)
            {
                lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued;
                lesson.AiError = null;
                _unitOfWork.Repository<Lesson>().Update(lesson);
                await _unitOfWork.SaveChangesAsync();

                _ = _webhookDispatcher.DispatchLessonUpdatedAsync(lesson.Id, lesson.VideoUrl, moduleId, lesson.UnitId);
            }
        }
        else
        {
            _unitOfWork.Repository<Lesson>().Update(lesson);
            await _unitOfWork.SaveChangesAsync();
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

        var unit = await _unitOfWork.Repository<Unit>().GetByIdAsync(lesson.UnitId);
        var moduleId = unit?.ModuleId;

        lesson.AiRetryCount++;
        lesson.AiError = null;

        var linked = await TryLinkExistingProcessedLessonAsync(lesson, moduleId);
        if (!linked)
        {
            lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.Queued;
            _unitOfWork.Repository<Lesson>().Update(lesson);
            await _unitOfWork.SaveChangesAsync();

            _ = _webhookDispatcher.DispatchLessonUpdatedAsync(lesson.Id, lesson.VideoUrl, moduleId, lesson.UnitId);
        }

        return Result<bool>.Success(true);
    }

    private static readonly Regex YouTubeRegex = new(@"(?:v=|\/)([a-zA-Z0-9_-]{11})", RegexOptions.Compiled);

    private static string ExtractVideoId(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return string.Empty;
        var match = YouTubeRegex.Match(url);
        return match.Success ? match.Groups[1].Value : url.Trim();
    }

    private async Task<bool> TryLinkExistingProcessedLessonAsync(Lesson lesson, Guid? moduleId)
    {
        if (string.IsNullOrWhiteSpace(lesson.VideoUrl))
            return false;

        var cleanVideoUrl = lesson.VideoUrl.Trim();
        var videoId = ExtractVideoId(cleanVideoUrl);

        // 1. Direct match on VideoUrl or fallback match on YouTube Video ID
        var match = await _unitOfWork.Repository<Lesson>().Query()
            .AsNoTracking()
            .Where(l => l.Id != lesson.Id 
                     && l.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.Completed
                     && l.VideoUrl != null 
                     && l.VideoUrl == cleanVideoUrl)
            .OrderByDescending(l => l.AiProcessedAt)
            .FirstOrDefaultAsync();

        if (match == null && !string.IsNullOrEmpty(videoId) && videoId.Length == 11)
        {
            match = await _unitOfWork.Repository<Lesson>().Query()
                .AsNoTracking()
                .Where(l => l.Id != lesson.Id 
                         && l.AiStatus == LearnDynamicPro.Domain.Enums.LessonAiStatus.Completed
                         && l.VideoUrl != null 
                         && l.VideoUrl.Contains(videoId))
                .OrderByDescending(l => l.AiProcessedAt)
                .FirstOrDefaultAsync();
        }

        if (match == null)
        {
            return false;
        }

        // 2. Clone processing state
        lesson.AiStatus = LearnDynamicPro.Domain.Enums.LessonAiStatus.Completed;
        lesson.AiChunksCount = match.AiChunksCount;
        lesson.AiProcessedAt = match.AiProcessedAt ?? DateTime.UtcNow;
        lesson.AiError = null;
        _unitOfWork.Repository<Lesson>().Update(lesson);

        // 3. Clone LessonQuiz if exists
        var existingQuiz = await _unitOfWork.Repository<LessonQuiz>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(q => q.LessonId == match.Id);

        if (existingQuiz != null && existingQuiz.Questions != null && existingQuiz.Questions.Count > 0)
        {
            var currentQuiz = await _unitOfWork.Repository<LessonQuiz>().Query()
                .FirstOrDefaultAsync(q => q.LessonId == lesson.Id);
            if (currentQuiz != null)
            {
                _unitOfWork.Repository<LessonQuiz>().Remove(currentQuiz);
            }

            var clonedQuiz = new LessonQuiz
            {
                LessonId = lesson.Id,
                GeneratedAt = existingQuiz.GeneratedAt,
                Questions = existingQuiz.Questions.Select(q => new QuizQuestion
                {
                    QuestionNumber = q.QuestionNumber,
                    QuestionText = q.QuestionText,
                    CorrectAnswerId = q.CorrectAnswerId,
                    Explanation = q.Explanation,
                    Options = q.Options?.Select(o => new QuizOption
                    {
                        OptionId = o.OptionId,
                        Text = o.Text
                    }).ToList() ?? new()
                }).ToList()
            };
            await _unitOfWork.Repository<LessonQuiz>().AddAsync(clonedQuiz);
        }

        // 4. Clone LessonSummary if exists
        var existingSummary = await _unitOfWork.Repository<LessonSummary>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.LessonId == match.Id);

        if (existingSummary != null && (!string.IsNullOrEmpty(existingSummary.Overview) || (existingSummary.Topics != null && existingSummary.Topics.Count > 0)))
        {
            var currentSummary = await _unitOfWork.Repository<LessonSummary>().Query()
                .FirstOrDefaultAsync(s => s.LessonId == lesson.Id);
            if (currentSummary != null)
            {
                _unitOfWork.Repository<LessonSummary>().Remove(currentSummary);
            }

            var clonedSummary = new LessonSummary
            {
                LessonId = lesson.Id,
                GeneratedAt = existingSummary.GeneratedAt,
                Overview = existingSummary.Overview,
                Topics = existingSummary.Topics?.Select(t => new SummaryTopic
                {
                    TopicName = t.TopicName,
                    Explanation = t.Explanation,
                    KeyPoints = t.KeyPoints != null ? new List<string>(t.KeyPoints) : new List<string>()
                }).ToList() ?? new()
            };
            await _unitOfWork.Repository<LessonSummary>().AddAsync(clonedSummary);
        }

        await _unitOfWork.SaveChangesAsync();

        // 5. Fire asynchronous Webhook to Python AI Engine to link vectors in Qdrant (<10ms)
        _ = _webhookDispatcher.DispatchLessonReferencedAsync(lesson.Id, lesson.VideoUrl!, moduleId, lesson.UnitId);

        return true;
    }
}

