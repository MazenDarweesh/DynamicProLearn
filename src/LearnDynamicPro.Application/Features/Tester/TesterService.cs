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
            await _unitOfWork.Repository<TesterActiveVersion>().AddAsync(activeVersion);
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

        if (moduleIds == null || moduleIds.Count == 0)
        {
            if (vt != null)
            {
                _unitOfWork.Repository<VersionTester>().Remove(vt);
                await _unitOfWork.SaveChangesAsync();
            }
            return Result<VersionTesterDto>.Success(new VersionTesterDto
            {
                VersionId = versionId,
                TesterId = testerId,
                TesterName = tester.Username,
                AssignedModulesCount = 0,
                ModuleIds = new List<Guid>()
            });
        }

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
            .ToListAsync();

        var versionIds = versions.Select(v => v.Id).ToList();

        var versionTesters = await _unitOfWork.Repository<VersionTester>().Query()
            .AsNoTracking()
            .Where(vt => versionIds.Contains(vt.VersionId) && vt.Tester != null && !vt.Tester.IsDeleted)
            .Select(vt => new { vt.VersionId, vt.TesterId })
            .ToListAsync();

        var versionModules = await _unitOfWork.Repository<VersionTesterModule>().Query()
            .AsNoTracking()
            .Where(vtm => vtm.VersionTester != null && vtm.VersionTester.Tester != null && !vtm.VersionTester.Tester.IsDeleted && versionIds.Contains(vtm.VersionTester.VersionId))
            .Select(vtm => new { vtm.VersionTester!.VersionId, vtm.ModuleId })
            .ToListAsync();

        var feedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
            .AsNoTracking()
            .Where(f => f.User != null && !f.User.IsDeleted && versionIds.Contains(f.ErpVersionId))
            .Select(f => f.ErpVersionId)
            .ToListAsync();

        var result = versions.Select(v => new VersionSummaryDto
        {
            VersionId = v.Id,
            VersionLabel = v.VersionLabel,
            TestersCount = versionTesters.Where(vt => vt.VersionId == v.Id).Select(vt => vt.TesterId).Distinct().Count(),
            TotalModulesAssigned = versionModules.Where(vtm => vtm.VersionId == v.Id).Select(vtm => vtm.ModuleId).Distinct().Count(),
            TotalFeedbacks = feedbacks.Count(f => f == v.Id)
        }).ToList();

        return Result<List<VersionSummaryDto>>.Success(result);
    }

    public async Task<Result<VersionProgressDto>> GetVersionProgressAsync(Guid versionId)
    {
        var version = await _unitOfWork.Repository<ErpVersion>().Query()
            .AsNoTracking()
            .Where(v => v.Id == versionId)
            .Select(v => new { v.Id, v.VersionLabel })
            .FirstOrDefaultAsync();

        if (version == null) return Result<VersionProgressDto>.Failure("Not found");

        // Fetch the full assigned hierarchy (testers → modules → units → lessons)
        var testersData = await _unitOfWork.Repository<VersionTester>().Query()
            .AsNoTracking()
            .Where(vt => vt.VersionId == versionId && vt.Tester != null && !vt.Tester.IsDeleted)
            .Select(vt => new
            {
                TesterId = vt.TesterId,
                TesterName = vt.Tester!.Username,
                Modules = vt.AssignedModules
                    .Where(am => am.Module != null)
                    .Select(am => new
                    {
                        ModuleId = am.ModuleId,
                        ModuleName = am.Module!.Name,
                        Units = am.Module.Units!
                            .Where(u => !u.IsDeleted)
                            .Select(u => new
                            {
                                UnitId = u.Id,
                                UnitName = u.Name,
                                Lessons = u.Lessons!
                                    .Where(l => !l.IsDeleted)
                                    .Select(l => new
                                    {
                                        LessonId = l.Id,
                                        LessonTitle = l.Title
                                    }).ToList()
                            }).ToList()
                    }).ToList()
            })
            .ToListAsync();

        var testerIds = testersData.Select(t => t.TesterId).Distinct().ToList();

        // Fetch completed LessonProgress for these testers
        var progresses = await _unitOfWork.Repository<LessonProgress>().Query()
            .AsNoTracking()
            .Where(p => testerIds.Contains(p.UserId) && p.IsCompleted)
            .Select(p => new { p.UserId, p.LessonId, p.CompletedAt })
            .ToListAsync();

        var progressLookup = progresses
            .GroupBy(p => $"{p.UserId}_{p.LessonId}")
            .ToDictionary(g => g.Key, g => g.First());

        // Fetch all feedbacks for this version
        var allFeedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
            .AsNoTracking()
            .Where(f => f.ErpVersionId == versionId && testerIds.Contains(f.UserId))
            .Select(f => new
            {
                f.UserId,
                f.LessonId,
                ConditionLabel = f.ConditionOption != null ? f.ConditionOption.Label : "تم التقييم",
                f.Notes,
                f.CreatedAt
            })
            .ToListAsync();

        var feedbackLookup = allFeedbacks
            .GroupBy(f => $"{f.UserId}_{f.LessonId}")
            .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.CreatedAt).First());

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

                foreach (var unit in am.Units)
                {
                    foreach (var lesson in unit.Lessons)
                    {
                        var key = $"{vt.TesterId}_{lesson.LessonId}";
                        feedbackLookup.TryGetValue(key, out var fb);
                        progressLookup.TryGetValue(key, out var prog);

                        var status = "غير مختبر";
                        if (prog != null) status = "مكتمل";
                        if (fb != null) status = !string.IsNullOrEmpty(fb.ConditionLabel) ? fb.ConditionLabel : "تم التقييم";

                        mDto.Lessons.Add(new LessonFeedbackDto
                        {
                            LessonId = lesson.LessonId,
                            LessonTitle = lesson.LessonTitle,
                            ConditionLabel = status,
                            Notes = fb?.Notes,
                            FeedbackDate = fb?.CreatedAt ?? prog?.CompletedAt
                        });
                    }
                }

                tDto.Modules.Add(mDto);
            }

            dto.Testers.Add(tDto);
        }

        return Result<VersionProgressDto>.Success(dto);
    }
}
