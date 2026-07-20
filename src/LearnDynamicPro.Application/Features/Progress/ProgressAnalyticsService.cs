using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Application.Dtos.Progress;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Progress;

public class ProgressAnalyticsService : IProgressAnalyticsService
{
    private readonly IUnitOfWork _unitOfWork;

    public ProgressAnalyticsService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<LearnDynamicPro.Application.Common.Result<List<ModuleAnalyticsDto>>> GetCurriculumAnalyticsAsync()
    {
        var modules = await _unitOfWork.Repository<Module>().Query()
            .AsNoTracking()
            .Select(m => new ModuleAnalyticsDto
            {
                ModuleId = m.Id,
                Name = m.Name,
                Description = m.Description,
                Units = m.Units.OrderBy(u => u.OrderIndex).Select(u => new UnitAnalyticsDto
                {
                    UnitId = u.Id,
                    Title = u.Name,
                    OrderIndex = u.OrderIndex,
                    Lessons = u.Lessons.OrderBy(l => l.OrderIndex).Select(l => new LessonAnalyticsDto
                    {
                        LessonId = l.Id,
                        Title = l.Title,
                        LevelId = l.LevelId,
                        LevelLabel = l.Level != null ? l.Level.Label : "",
                        TypeId = l.TypeId,
                        TypeLabel = l.Type != null ? l.Type.Label : "",
                        OrderIndex = l.OrderIndex,
                        EnrolledStudentsCount = m.Assignments
                            .Where(a => a.Department != null && a.Department.Company != null)
                            .Where(a => 
                                (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                                (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                            .SelectMany(a => a.Department!.Users)
                            .Where(user => user.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                            .Select(u => u.Id)
                            .Distinct()
                            .Count(),
                        CompletedStudentsCount = m.Assignments
                            .Where(a => a.Department != null && a.Department.Company != null)
                            .Where(a => 
                                (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                                (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                            .SelectMany(a => a.Department!.Users)
                            .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                            .Select(u => u.Id)
                            .Distinct()
                            .Count(uid => l.Progresses.Any(p => p.UserId == uid && p.IsCompleted))
                    }).ToList()
                }).ToList()
            })
            .ToListAsync();

        return LearnDynamicPro.Application.Common.Result<List<ModuleAnalyticsDto>>.Success(modules);
    }

    public async Task<LearnDynamicPro.Application.Common.Result<LessonDetailsAnalyticsDto>> GetLessonAnalyticsAsync(Guid lessonId)
    {
        var lessonDto = await _unitOfWork.Repository<Lesson>().Query()
            .AsNoTracking()
            .Where(l => l.Id == lessonId)
            .Select(l => new LessonDetailsAnalyticsDto
            {
                LessonId = l.Id,
                LessonTitle = l.Title,
                ModuleName = l.Unit != null && l.Unit.Module != null ? l.Unit.Module.Name : "",
                UnitName = l.Unit != null ? l.Unit.Name : "",
                
                TotalCompanies = l.Unit!.Module!.Assignments
                    .Where(a => a.Department != null && a.Department.Company != null)
                    .Where(a => 
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                    .Select(a => a.Department!.CompanyId)
                    .Distinct()
                    .Count(),
                    
                TotalDepartments = l.Unit!.Module!.Assignments
                    .Where(a => a.Department != null && a.Department.Company != null)
                    .Where(a => 
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                    .Select(a => a.DepartmentId)
                    .Distinct()
                    .Count(),
                    
                TotalEnrolledStudents = l.Unit!.Module!.Assignments
                    .Where(a => a.Department != null && a.Department.Company != null)
                    .Where(a => 
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                    .SelectMany(a => a.Department!.Users)
                    .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                    .Select(u => u.Id)
                    .Distinct()
                    .Count(),

                TotalCompletedStudents = l.Unit!.Module!.Assignments
                    .Where(a => a.Department != null && a.Department.Company != null)
                    .Where(a => 
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                    .SelectMany(a => a.Department!.Users)
                    .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                    .Select(u => u.Id)
                    .Distinct()
                    .Count(uid => l.Progresses.Any(p => p.UserId == uid && p.IsCompleted)),

                Companies = l.Unit!.Module!.Assignments
                    .Where(a => 
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                    .GroupBy(a => a.Department!.Company)
                    .Select(cg => new CompanyLessonAnalyticsDto
                    {
                        CompanyId = cg.Key!.Id,
                        CompanyName = cg.Key.Name,
                        IsFullyCompleted = cg.SelectMany(a => a.Department!.Users)
                            .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                            .All(u => l.Progresses.Any(p => p.UserId == u.Id && p.IsCompleted)),
                        Departments = cg.GroupBy(a => a.DepartmentId).Select(dg => new DepartmentLessonAnalyticsDto
                        {
                            DepartmentId = dg.Key,
                            DepartmentName = dg.FirstOrDefault()!.Department!.Name,
                            IsFullyCompleted = dg.FirstOrDefault()!.Department!.Users
                                .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                                .All(u => l.Progresses.Any(p => p.UserId == u.Id && p.IsCompleted)),
                            Users = dg.FirstOrDefault()!.Department!.Users
                                .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                                .Select(u => new UserLessonAnalyticsDto
                                {
                                    UserId = u.Id,
                                    UserName = u.Username,
                                    IsCompleted = l.Progresses.Any(p => p.UserId == u.Id && p.IsCompleted)
                                }).ToList()
                        }).ToList()
                    }).ToList()
            })
            .FirstOrDefaultAsync();

        if (lessonDto == null) return LearnDynamicPro.Application.Common.Result<LessonDetailsAnalyticsDto>.Failure(LearnDynamicPro.Application.Common.AppErrors.General.NotFound);
        return LearnDynamicPro.Application.Common.Result<LessonDetailsAnalyticsDto>.Success(lessonDto);
    }

    public async Task<LearnDynamicPro.Application.Common.Result> CompleteLessonForTargetAsync(Guid lessonId, string targetType, Guid targetId)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().GetByIdAsync(lessonId);
        if (lesson == null) return LearnDynamicPro.Application.Common.Result.Failure(LearnDynamicPro.Application.Common.AppErrors.General.NotFound);

        List<User> targetUsers = new();

        if (targetType.Equals("company", StringComparison.OrdinalIgnoreCase))
        {
            targetUsers = await _unitOfWork.Repository<User>().Query()
                .Where(u => u.CompanyId == targetId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                .ToListAsync();
        }
        else if (targetType.Equals("department", StringComparison.OrdinalIgnoreCase))
        {
            targetUsers = await _unitOfWork.Repository<User>().Query()
                .Where(u => u.DepartmentId == targetId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                .ToListAsync();
        }
        else if (targetType.Equals("user", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _unitOfWork.Repository<User>().GetByIdAsync(targetId);
            if (user != null) targetUsers.Add(user);
        }
        else
        {
            return LearnDynamicPro.Application.Common.Result.Failure(LearnDynamicPro.Application.Common.AppErrors.General.ValidationFailed);
        }

        var targetUserIds = targetUsers.Select(u => u.Id).ToList();
        var existingProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
            .Where(p => p.LessonId == lessonId && targetUserIds.Contains(p.UserId))
            .ToListAsync();

        foreach (var user in targetUsers)
        {
            var progress = existingProgresses.FirstOrDefault(p => p.UserId == user.Id);
            if (progress == null)
            {
                await _unitOfWork.Repository<LessonProgress>().AddAsync(new LessonProgress
                {
                    LessonId = lessonId,
                    UserId = user.Id,
                    IsCompleted = true
                });
            }
            else
            {
                progress.IsCompleted = true;
                _unitOfWork.Repository<LessonProgress>().Update(progress);
            }
        }

        await _unitOfWork.SaveChangesAsync();
        return LearnDynamicPro.Application.Common.Result.Success();
    }

    public async Task<LearnDynamicPro.Application.Common.Result> UncompleteLessonForTargetAsync(Guid lessonId, string targetType, Guid targetId)
    {
        var lesson = await _unitOfWork.Repository<Lesson>().GetByIdAsync(lessonId);
        if (lesson == null) return LearnDynamicPro.Application.Common.Result.Failure(LearnDynamicPro.Application.Common.AppErrors.General.NotFound);

        List<User> targetUsers = new();

        if (targetType.Equals("company", StringComparison.OrdinalIgnoreCase))
        {
            targetUsers = await _unitOfWork.Repository<User>().Query()
                .Where(u => u.CompanyId == targetId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                .ToListAsync();
        }
        else if (targetType.Equals("department", StringComparison.OrdinalIgnoreCase))
        {
            targetUsers = await _unitOfWork.Repository<User>().Query()
                .Where(u => u.DepartmentId == targetId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
                .ToListAsync();
        }
        else if (targetType.Equals("user", StringComparison.OrdinalIgnoreCase))
        {
            var user = await _unitOfWork.Repository<User>().GetByIdAsync(targetId);
            if (user != null) targetUsers.Add(user);
        }
        else
        {
            return LearnDynamicPro.Application.Common.Result.Failure(LearnDynamicPro.Application.Common.AppErrors.General.ValidationFailed);
        }

        var targetUserIds = targetUsers.Select(u => u.Id).ToList();

        var existingProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
            .Where(p => p.LessonId == lessonId && targetUserIds.Contains(p.UserId))
            .ToListAsync();

        foreach (var progress in existingProgresses)
        {
            progress.IsCompleted = false;
            _unitOfWork.Repository<LessonProgress>().Update(progress);
        }

        await _unitOfWork.SaveChangesAsync();
        return LearnDynamicPro.Application.Common.Result.Success();
    }

    public async Task<Dictionary<Guid, ProgressResult>> GetUsersProgressAsync(List<Guid> userIds)
    {
        if (userIds == null || !userIds.Any()) return new Dictionary<Guid, ProgressResult>();

        var usersInfo = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DepartmentId, u.Role })
            .ToListAsync();

        var departmentIds = usersInfo.Where(u => u.DepartmentId.HasValue).Select(u => u.DepartmentId!.Value).Distinct().ToList();
        var testerIds = usersInfo.Where(u => u.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester).Select(u => u.Id).ToList();

        var departmentLessons = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => departmentIds.Contains(a.DepartmentId) && a.Module != null && a.Module.Units != null)
            .Select(a => new 
            {
                DepartmentId = a.DepartmentId,
                LessonIds = a.Module!.Units.Where(u => u.Lessons != null)
                    .SelectMany(u => u.Lessons)
                    .Where(l => 
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId)))
                    .Select(l => l.Id)
                    .ToList()
            })
            .ToListAsync();

        var testerLessons = await _unitOfWork.Repository<VersionTester>().Query()
            .AsNoTracking()
            .Where(tc => testerIds.Contains(tc.TesterId))
            .Select(tc => new 
            {
                TesterId = tc.TesterId,
                LessonIds = tc.AssignedModules
                    .Where(am => am.Module != null && am.Module.Units != null)
                    .SelectMany(am => am.Module!.Units)
                    .Where(u => u.Lessons != null)
                    .SelectMany(u => u.Lessons)
                    .Select(l => l.Id)
                    .ToList()
            })
            .ToListAsync();

        var allAssignedLessonIds = new HashSet<Guid>();
        foreach (var dl in departmentLessons) { foreach(var id in dl.LessonIds) allAssignedLessonIds.Add(id); }
        foreach (var tl in testerLessons) { foreach(var id in tl.LessonIds) allAssignedLessonIds.Add(id); }

        var completions = new List<LessonProgress>();
        if (allAssignedLessonIds.Any())
        {
            var allAssignedLessonIdsList = allAssignedLessonIds.ToList();
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && userIds.Contains(p.UserId) && allAssignedLessonIdsList.Contains(p.LessonId))
                .ToListAsync();
        }

        var result = new Dictionary<Guid, ProgressResult>();

        foreach (var user in usersInfo)
        {
            HashSet<Guid> assignedLessonIds;

            if (user.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester)
            {
                assignedLessonIds = testerLessons
                    .Where(t => t.TesterId == user.Id)
                    .SelectMany(t => t.LessonIds)
                    .ToHashSet();
            }
            else
            {
                assignedLessonIds = departmentLessons
                    .Where(d => user.DepartmentId.HasValue && d.DepartmentId == user.DepartmentId.Value)
                    .SelectMany(d => d.LessonIds)
                    .ToHashSet();
            }

            var completedCount = completions.Count(c => c.UserId == user.Id && assignedLessonIds.Contains(c.LessonId));

            result[user.Id] = new ProgressResult 
            { 
                Completed = completedCount, 
                Total = assignedLessonIds.Count 
            };
        }

        foreach (var id in userIds)
        {
            if (!result.ContainsKey(id)) result[id] = new ProgressResult { Completed = 0, Total = 0 };
        }

        return result;
    }

    public async Task<Dictionary<Guid, ProgressResult>> GetDepartmentsProgressAsync(List<Guid> departmentIds)
    {
        if (departmentIds == null || !departmentIds.Any()) return new Dictionary<Guid, ProgressResult>();

        var departmentData = await _unitOfWork.Repository<Department>().Query()
            .AsNoTracking()
            .Where(d => departmentIds.Contains(d.Id))
            .Select(d => new 
            {
                Id = d.Id,
                UserIds = d.Users.Select(u => u.Id).ToList(),
                AssignedLessonIds = d.Assignments
                    .Where(a => a.Module != null && a.Module.Units != null)
                    .SelectMany(a => a.Module!.Units)
                    .Where(u => u.Lessons != null)
                    .SelectMany(u => u.Lessons)
                    .Where(l => d.Assignments.Any(a => 
                        a.ModuleId == l.Unit!.ModuleId &&
                        (!a.LevelFilters.Any() || a.LevelFilters.Any(lf => lf.LevelId == l.LevelId)) &&
                        (!a.TypeFilters.Any() || a.TypeFilters.Any(tf => tf.TypeId == l.TypeId))))
                    .Select(l => l.Id)
                    .ToList()
            })
            .ToListAsync();

        var allUserIds = departmentData.SelectMany(d => d.UserIds).Distinct().ToList();
        var allAssignedLessonIds = departmentData.SelectMany(d => d.AssignedLessonIds).Distinct().ToList();

        var completions = new List<LessonProgress>();
        if (allUserIds.Any() && allAssignedLessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && allUserIds.Contains(p.UserId) && allAssignedLessonIds.Contains(p.LessonId))
                .ToListAsync();
        }

        var result = new Dictionary<Guid, ProgressResult>();

        foreach (var dept in departmentData)
        {
            var deptUserIds = dept.UserIds.ToHashSet();
            var deptLessonIds = dept.AssignedLessonIds.ToHashSet();

            var completedCount = completions.Count(c => deptUserIds.Contains(c.UserId) && deptLessonIds.Contains(c.LessonId));

            result[dept.Id] = new ProgressResult 
            { 
                Completed = completedCount, 
                Total = dept.UserIds.Count * dept.AssignedLessonIds.Count 
            };
        }

        foreach (var id in departmentIds)
        {
            if (!result.ContainsKey(id)) result[id] = new ProgressResult { Completed = 0, Total = 0 };
        }

        return result;
    }

    public async Task<Dictionary<Guid, ProgressResult>> GetCompaniesProgressAsync(List<Guid> companyIds)
    {
        if (companyIds == null || !companyIds.Any()) return new Dictionary<Guid, ProgressResult>();

        var departments = await _unitOfWork.Repository<Department>().Query()
            .AsNoTracking()
            .Where(d => companyIds.Contains(d.CompanyId))
            .Select(d => new { d.Id, d.CompanyId })
            .ToListAsync();

        var departmentIds = departments.Select(d => d.Id).ToList();
        var deptProgressMap = await GetDepartmentsProgressAsync(departmentIds);

        var result = new Dictionary<Guid, ProgressResult>();

        foreach (var companyId in companyIds)
        {
            var companyDeptIds = departments.Where(d => d.CompanyId == companyId).Select(d => d.Id).ToList();
            
            var totalCompleted = companyDeptIds.Sum(id => deptProgressMap.ContainsKey(id) ? deptProgressMap[id].Completed : 0);
            var totalAssigned = companyDeptIds.Sum(id => deptProgressMap.ContainsKey(id) ? deptProgressMap[id].Total : 0);

            result[companyId] = new ProgressResult 
            { 
                Completed = totalCompleted, 
                Total = totalAssigned 
            };
        }

        foreach (var id in companyIds)
        {
            if (!result.ContainsKey(id)) result[id] = new ProgressResult { Completed = 0, Total = 0 };
        }

        return result;
    }

    public async Task<ProgressResult> GetOverallSystemProgressAsync()
    {
        // To avoid double-counting, ghost progress, and tester inclusion, 
        // the most accurate way is to aggregate the progress of all active students.
        var studentIds = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
            .Select(u => u.Id)
            .ToListAsync();

        var progresses = await GetUsersProgressAsync(studentIds);

        int totalCompleted = progresses.Values.Sum(p => p.Completed);
        int totalPossible = progresses.Values.Sum(p => p.Total);

        return new ProgressResult 
        { 
            Completed = totalCompleted, 
            Total = totalPossible 
        };
    }
}
