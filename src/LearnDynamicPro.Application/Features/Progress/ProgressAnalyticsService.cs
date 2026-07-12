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

    public async Task<Dictionary<Guid, ProgressResult>> GetUsersProgressAsync(List<Guid> userIds)
    {
        if (userIds == null || !userIds.Any()) return new Dictionary<Guid, ProgressResult>();

        var userDepartments = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DepartmentId })
            .ToListAsync();

        var departmentIds = userDepartments.Select(u => u.DepartmentId).Distinct().ToList();

        var departmentLessons = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => departmentIds.Contains(a.DepartmentId) && a.Module != null && a.Module.Units != null)
            .Select(a => new 
            {
                DepartmentId = a.DepartmentId,
                LessonIds = a.Module!.Units.Where(u => u.Lessons != null).SelectMany(u => u.Lessons).Select(l => l.Id).ToList()
            })
            .ToListAsync();

        var allAssignedLessonIds = departmentLessons.SelectMany(d => d.LessonIds).Distinct().ToList();

        var completions = new List<LessonProgress>();
        if (allAssignedLessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && userIds.Contains(p.UserId) && allAssignedLessonIds.Contains(p.LessonId))
                .ToListAsync();
        }

        var result = new Dictionary<Guid, ProgressResult>();

        foreach (var user in userDepartments)
        {
            var assignedLessonIds = departmentLessons
                .Where(d => d.DepartmentId == user.DepartmentId)
                .SelectMany(d => d.LessonIds)
                .ToHashSet();

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
        var totalPossibleLessons = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.Department != null && a.Module != null)
            .Select(a => a.Department!.Users.Count * a.Module!.Units.SelectMany(u => u.Lessons).Count())
            .SumAsync();

        int totalCompleted = await _unitOfWork.Repository<LessonProgress>().Query()
            .CountAsync(p => p.IsCompleted);

        return new ProgressResult 
        { 
            Completed = totalCompleted, 
            Total = totalPossibleLessons 
        };
    }
}
