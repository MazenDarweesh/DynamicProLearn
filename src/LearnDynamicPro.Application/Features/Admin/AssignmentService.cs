using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.Application.Features.Admin;

public class AssignmentService : IAssignmentService
{
    private readonly IApplicationDbContext _context;

    public AssignmentService(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<DepartmentModuleDto>> AssignModuleToDepartmentAsync(AssignModuleRequest request)
    {
        var assignment = new DepartmentModuleAssignment
        {
            DepartmentId = request.DepartmentId,
            ModuleId = request.ModuleId,
            LevelId = request.LevelId,
            TypeId = request.TypeId
        };

        _context.DepartmentModuleAssignments.Add(assignment);
        await _context.SaveChangesAsync(default);

        return Result<DepartmentModuleDto>.Success(new DepartmentModuleDto
        {
            Id = assignment.Id,
            DepartmentId = assignment.DepartmentId,
            ModuleId = assignment.ModuleId,
            LevelId = assignment.LevelId,
            TypeId = assignment.TypeId
        });
    }

    public async Task<Result> RemoveAssignmentAsync(Guid assignmentId)
    {
        var assignment = await _context.DepartmentModuleAssignments.FindAsync(assignmentId);
        if (assignment != null)
        {
            _context.DepartmentModuleAssignments.Remove(assignment);
            await _context.SaveChangesAsync(default);
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<DepartmentModuleDto>>> GetAssignmentsByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 100)
    {
        var query = _context.DepartmentModuleAssignments
            .AsNoTracking()
            .Where(a => a.DepartmentId == departmentId);
            
        var totalCount = await query.CountAsync();

        var assignments = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new DepartmentModuleDto
            {
                Id = a.Id,
                DepartmentId = a.DepartmentId,
                ModuleId = a.ModuleId,
                LevelId = a.LevelId,
                TypeId = a.TypeId
            })
            .ToListAsync();
            
        var pagedList = new PagedList<DepartmentModuleDto>(assignments, totalCount, page, pageSize);
        return Result<PagedList<DepartmentModuleDto>>.Success(pagedList);
    }
}

