using LearnDynamicPro.Application.Dtos.Tester;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;

namespace LearnDynamicPro.Application.Features.Tester;

public class TesterService : ITesterService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentUserService _currentUserService;

    public TesterService(IUnitOfWork unitOfWork, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _currentUserService = currentUserService;
    }

    public async Task<Result<ErpVersionDto>> CreateErpVersionAsync(CreateErpVersionRequest request)
    {
        var version = new ErpVersion { VersionLabel = request.VersionLabel };
        await _unitOfWork.Repository<ErpVersion>().AddAsync(version);
        await _unitOfWork.SaveChangesAsync();

        return Result<ErpVersionDto>.Success(new ErpVersionDto { Id = version.Id, VersionLabel = version.VersionLabel });
    }

    public async Task<Result<List<ErpVersionDto>>> GetAllErpVersionsAsync()
    {
        var versions = await _unitOfWork.Repository<ErpVersion>().Query()
            .AsNoTracking()
            .Select(v => new ErpVersionDto { Id = v.Id, VersionLabel = v.VersionLabel })
            .ToListAsync();
            
        return Result<List<ErpVersionDto>>.Success(versions);
    }

    public async Task<Result> SetActiveVersionAsync(SetActiveVersionRequest request)
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _unitOfWork.Repository<TesterActiveVersion>().Query()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
        {
            activeVersion = new TesterActiveVersion
            {
                UserId = userId,
                ErpVersionId = request.ErpVersionId,
                BranchName = request.BranchName
            };
            _unitOfWork.Repository<TesterActiveVersion>().AddAsync(activeVersion);
        }
        else
        {
            activeVersion.ErpVersionId = request.ErpVersionId;
            activeVersion.BranchName = request.BranchName;
        }

        await _unitOfWork.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result<FeedbackDto>> SubmitFeedbackAsync(SubmitFeedbackRequest request)
    {
        var userId = _currentUserService.UserId;

        var activeVersion = await _unitOfWork.Repository<TesterActiveVersion>().Query()
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

        await _unitOfWork.Repository<TesterFeedback>().AddAsync(feedback);
        await _unitOfWork.SaveChangesAsync();

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

        var activeVersion = await _unitOfWork.Repository<TesterActiveVersion>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
            return Result<List<FeedbackDto>>.Success(new List<FeedbackDto>());

        var feedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
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

    public async Task<Result<List<LookupDto>>> GetConditionOptionsAsync()
    {
        var options = await _unitOfWork.Repository<FeedbackConditionOption>().Query()
            .AsNoTracking()
            .Where(o => o.IsActive)
            .Select(o => new LookupDto
            {
                Id = o.Id.ToString(),
                Label = o.Label
            })
            .ToListAsync();

        return Result<List<LookupDto>>.Success(options);
    }
    public async Task<Result<List<TestCycleDto>>> GetAllTestCyclesAsync()
    {
        var cycles = await _unitOfWork.Repository<ErpVersion>().Query()
            .AsNoTracking()
            .Select(v => new TestCycleDto
            {
                Id = v.TestCycles.FirstOrDefault() != null ? v.TestCycles.FirstOrDefault()!.Id : Guid.Empty,
                VersionId = v.Id,
                VersionLabel = v.VersionLabel,
                TesterId = v.TestCycles.FirstOrDefault() != null ? v.TestCycles.FirstOrDefault()!.TesterId : Guid.Empty,
                TesterName = v.TestCycles.FirstOrDefault() != null ? v.TestCycles.FirstOrDefault()!.Tester!.Username : string.Empty,
                AssignedModulesCount = v.TestCycles.FirstOrDefault() != null ? v.TestCycles.FirstOrDefault()!.AssignedModules.Count() : 0,
                ModuleIds = v.TestCycles.FirstOrDefault() != null ? v.TestCycles.FirstOrDefault()!.AssignedModules.Select(m => m.ModuleId).ToList() : new List<Guid>()
            })
            .ToListAsync();

        return Result<List<TestCycleDto>>.Success(cycles);
    }

    public async Task<Result<TestCycleDto>> CreateTestCycleAsync(CreateTestCycleRequest request)
    {
        var version = new ErpVersion { VersionLabel = request.VersionLabel };
        await _unitOfWork.Repository<ErpVersion>().AddAsync(version);

        var testCycle = new TestCycle
        {
            VersionId = version.Id,
            TesterId = request.TesterId
        };
        await _unitOfWork.Repository<TestCycle>().AddAsync(testCycle);

        await _unitOfWork.SaveChangesAsync();

        return Result<TestCycleDto>.Success(new TestCycleDto
        {
            Id = testCycle.Id,
            VersionId = version.Id,
            VersionLabel = version.VersionLabel,
            TesterId = testCycle.TesterId
        });
    }

    public async Task<Result> AssignModulesToTestCycleAsync(Guid testCycleId, AssignModulesToTestCycleRequest request)
    {
        var testCycle = await _unitOfWork.Repository<TestCycle>().Query()
            .Include(tc => tc.AssignedModules)
            .FirstOrDefaultAsync(tc => tc.Id == testCycleId);

        if (testCycle == null)
            return Result.Failure("Test cycle not found");

        _unitOfWork.Repository<TestCycleModule>().RemoveRange(testCycle.AssignedModules);
        
        foreach (var modId in request.ModuleIds)
        {
            await _unitOfWork.Repository<TestCycleModule>().AddAsync(new TestCycleModule
            {
                TestCycleId = testCycleId,
                ModuleId = modId
            });
        }

        await _unitOfWork.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> UpdateTestCycleAsync(Guid testCycleId, UpdateTestCycleRequest request)
    {
        var testCycle = await _unitOfWork.Repository<TestCycle>().Query()
            .Include(tc => tc.AssignedModules)
            .Include(tc => tc.Version)
            .FirstOrDefaultAsync(tc => tc.Id == testCycleId);

        if (testCycle == null) return Result.Failure("Test cycle not found");

        if (testCycle.Version != null)
        {
            testCycle.Version.VersionLabel = request.VersionLabel;
            _unitOfWork.Repository<ErpVersion>().Update(testCycle.Version);
        }

        testCycle.TesterId = request.TesterId;
        _unitOfWork.Repository<TestCycle>().Update(testCycle);

        _unitOfWork.Repository<TestCycleModule>().RemoveRange(testCycle.AssignedModules);
        foreach (var modId in request.ModuleIds)
        {
            await _unitOfWork.Repository<TestCycleModule>().AddAsync(new TestCycleModule
            {
                TestCycleId = testCycleId,
                ModuleId = modId
            });
        }

        await _unitOfWork.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> DeleteTestCycleAsync(Guid testCycleId)
    {
        var testCycle = await _unitOfWork.Repository<TestCycle>().GetByIdAsync(testCycleId);
        if (testCycle == null) return Result.Failure("Not found");

        var versionId = testCycle.VersionId;
        
        _unitOfWork.Repository<TestCycle>().Remove(testCycle);
        
        var version = await _unitOfWork.Repository<ErpVersion>().GetByIdAsync(versionId);
        if (version != null) _unitOfWork.Repository<ErpVersion>().Remove(version);

        await _unitOfWork.SaveChangesAsync();
        return Result.Success();
    }
}
