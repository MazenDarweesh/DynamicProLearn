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

    public async Task<Result> UpdateErpVersionAsync(Guid versionId, UpdateErpVersionRequest request)
    {
        var version = await _unitOfWork.Repository<ErpVersion>().GetByIdAsync(versionId);
        if (version == null) return Result.Failure("الإصدار غير موجود.");

        version.VersionLabel = request.VersionLabel;
        _unitOfWork.Repository<ErpVersion>().Update(version);
        await _unitOfWork.SaveChangesAsync();

        return Result.Success();
    }

    public async Task<Result> DeleteErpVersionAsync(Guid versionId)
    {
        var version = await _unitOfWork.Repository<ErpVersion>().GetByIdAsync(versionId);
        if (version == null) return Result.Failure("الإصدار غير موجود.");

        _unitOfWork.Repository<ErpVersion>().Remove(version);
        await _unitOfWork.SaveChangesAsync();

        return Result.Success();
    }

    public async Task<Result<List<ErpVersionDto>>> GetMyVersionsAsync()
    {
        var userId = _currentUserService.UserId;
        var versions = await _unitOfWork.Repository<VersionTester>().Query()
            .AsNoTracking()
            .Where(vt => vt.TesterId == userId)
            .Select(vt => new ErpVersionDto { Id = vt.Version!.Id, VersionLabel = vt.Version.VersionLabel })
            .ToListAsync();
            
        return Result<List<ErpVersionDto>>.Success(versions);
    }

    public async Task<Result<List<LearnDynamicPro.Application.Dtos.Modules.ModuleDto>>> GetMyModulesAsync()
    {
        var userId = _currentUserService.UserId;
        
        var activeVersion = await _unitOfWork.Repository<TesterActiveVersion>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (activeVersion == null)
            return Result<List<LearnDynamicPro.Application.Dtos.Modules.ModuleDto>>.Success(new List<LearnDynamicPro.Application.Dtos.Modules.ModuleDto>());

        var modules = await _unitOfWork.Repository<VersionTesterModule>().Query()
            .AsNoTracking()
            .Where(vtm => vtm.VersionTester!.TesterId == userId && vtm.VersionTester.VersionId == activeVersion.ErpVersionId)
            .Select(vtm => new LearnDynamicPro.Application.Dtos.Modules.ModuleDto 
            { 
                Id = vtm.Module!.Id, 
                Name = vtm.Module.Name, 
                Description = vtm.Module.Description 
            })
            .ToListAsync();

        return Result<List<LearnDynamicPro.Application.Dtos.Modules.ModuleDto>>.Success(modules);
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

    public async Task<Result<VersionTesterDto>> AssignTesterToVersionAsync(Guid versionId, Guid testerId, List<Guid> moduleIds)
    {
        var version = await _unitOfWork.Repository<ErpVersion>().GetByIdAsync(versionId);
        if (version == null) return Result<VersionTesterDto>.Failure("Version not found");

        var tester = await _unitOfWork.Repository<User>().GetByIdAsync(testerId);
        if (tester == null || tester.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester) 
            return Result<VersionTesterDto>.Failure("Invalid Tester");

        var vt = await _unitOfWork.Repository<VersionTester>().Query()
            .Include(x => x.AssignedModules)
            .FirstOrDefaultAsync(x => x.VersionId == versionId && x.TesterId == testerId);

        if (vt == null)
        {
            vt = new VersionTester { VersionId = versionId, TesterId = testerId };
            await _unitOfWork.Repository<VersionTester>().AddAsync(vt);
            await _unitOfWork.SaveChangesAsync(); // Need Id
        }
        else
        {
            _unitOfWork.Repository<VersionTesterModule>().RemoveRange(vt.AssignedModules);
        }

        foreach (var mId in moduleIds)
        {
            await _unitOfWork.Repository<VersionTesterModule>().AddAsync(new VersionTesterModule
            {
                VersionTesterId = vt.Id,
                ModuleId = mId
            });
        }
        await _unitOfWork.SaveChangesAsync();

        return Result<VersionTesterDto>.Success(new VersionTesterDto
        {
            Id = vt.Id,
            VersionId = vt.VersionId,
            TesterId = vt.TesterId,
            TesterName = tester.Username,
            AssignedModulesCount = moduleIds.Count,
            ModuleIds = moduleIds
        });
    }

    public async Task<Result<List<VersionSummaryDto>>> GetVersionSummariesAsync()
    {
        var versions = await _unitOfWork.Repository<ErpVersion>().Query()
            .AsNoTracking()
            .Select(v => new VersionSummaryDto
            {
                VersionId = v.Id,
                VersionLabel = v.VersionLabel,
                TestersCount = _unitOfWork.Repository<VersionTester>().Query().Count(vt => vt.VersionId == v.Id),
                TotalModulesAssigned = _unitOfWork.Repository<VersionTesterModule>().Query().Count(vtm => vtm.VersionTester!.VersionId == v.Id),
                TotalFeedbacks = _unitOfWork.Repository<TesterFeedback>().Query().Count(f => f.ErpVersionId == v.Id)
            })
            .ToListAsync();
            
        return Result<List<VersionSummaryDto>>.Success(versions);
    }

    public async Task<Result<VersionProgressDto>> GetVersionProgressAsync(Guid versionId)
    {
        var version = await _unitOfWork.Repository<ErpVersion>().Query()
            .AsNoTracking()
            .Where(v => v.Id == versionId)
            .Select(v => new { v.Id, v.VersionLabel })
            .FirstOrDefaultAsync();

        if (version == null) return Result<VersionProgressDto>.Failure("Not found");

        var testersData = await _unitOfWork.Repository<VersionTester>().Query()
            .AsNoTracking()
            .Where(vt => vt.VersionId == versionId)
            .Select(vt => new 
            {
                TesterId = vt.TesterId,
                TesterName = vt.Tester!.Username,
                Modules = vt.AssignedModules.Select(am => new 
                {
                    ModuleId = am.ModuleId,
                    ModuleName = am.Module!.Name
                }).ToList()
            })
            .ToListAsync();

        var allFeedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
            .AsNoTracking()
            .Where(f => f.ErpVersionId == versionId && f.Lesson != null && f.Lesson.Unit != null)
            .Select(f => new 
            {
                f.UserId,
                ModuleId = f.Lesson!.Unit!.ModuleId,
                f.LessonId,
                LessonTitle = f.Lesson.Title,
                ConditionLabel = f.ConditionOption != null ? f.ConditionOption.Label : null,
                f.Notes,
                f.CreatedAt
            })
            .ToListAsync();

        var dto = new VersionProgressDto
        {
            VersionId = version.Id,
            VersionLabel = version.VersionLabel,
            Testers = new List<TesterProgressInVersionDto>()
        };

        foreach (var vt in testersData)
        {
            var tDto = new TesterProgressInVersionDto
            {
                TesterId = vt.TesterId,
                TesterName = vt.TesterName,
                Modules = new List<ModuleProgressDto>()
            };

            foreach (var am in vt.Modules)
            {
                var mDto = new ModuleProgressDto
                {
                    ModuleId = am.ModuleId,
                    ModuleName = am.ModuleName,
                    Lessons = new List<LessonFeedbackDto>()
                };

                var mFeedbacks = allFeedbacks.Where(f => 
                    f.UserId == vt.TesterId && 
                    f.ModuleId == am.ModuleId).ToList();

                foreach (var f in mFeedbacks)
                {
                    mDto.Lessons.Add(new LessonFeedbackDto
                    {
                        LessonId = f.LessonId,
                        LessonTitle = f.LessonTitle,
                        ConditionLabel = f.ConditionLabel,
                        Notes = f.Notes,
                        FeedbackDate = f.CreatedAt
                    });
                }
                tDto.Modules.Add(mDto);
            }
            dto.Testers.Add(tDto);
        }

        return Result<VersionProgressDto>.Success(dto);
    }
}
