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

    public async Task<Result<List<DepartmentModuleDto>>> GetAssignmentsByDepartmentAsync(Guid departmentId)
    {
        var assignments = await _context.DepartmentModuleAssignments
            .AsNoTracking()
            .Where(a => a.DepartmentId == departmentId)
            .Select(a => new DepartmentModuleDto
            {
                Id = a.Id,
                DepartmentId = a.DepartmentId,
                ModuleId = a.ModuleId,
                LevelId = a.LevelId,
                TypeId = a.TypeId
            })
            .ToListAsync();
            
        return Result<List<DepartmentModuleDto>>.Success(assignments);
    }
}

