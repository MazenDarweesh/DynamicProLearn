using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;

namespace LearnDynamicPro.Application.Features.Admin;

public class AssignmentService : IAssignmentService
{
    private readonly IUnitOfWork _unitOfWork;

    public AssignmentService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DepartmentModuleDto>> AssignModuleToDepartmentAsync(AssignModuleRequest request)
    {
        var assignment = new DepartmentModuleAssignment
        {
            DepartmentId = request.DepartmentId,
            ModuleId = request.ModuleId,
        };

        await _unitOfWork.Repository<DepartmentModuleAssignment>().AddAsync(assignment);
        await _unitOfWork.SaveChangesAsync(); // Need Id first

        if (request.LevelIds != null && request.LevelIds.Any())
        {
            foreach (var levelId in request.LevelIds)
            {
                await _unitOfWork.Repository<AssignmentLevelFilter>().AddAsync(new AssignmentLevelFilter 
                { 
                    AssignmentId = assignment.Id, 
                    LevelId = levelId 
                });
            }
        }

        if (request.TypeIds != null && request.TypeIds.Any())
        {
            foreach (var typeId in request.TypeIds)
            {
                await _unitOfWork.Repository<AssignmentTypeFilter>().AddAsync(new AssignmentTypeFilter 
                { 
                    AssignmentId = assignment.Id, 
                    TypeId = typeId 
                });
            }
        }

        if (request.LevelIds?.Any() == true || request.TypeIds?.Any() == true)
        {
            await _unitOfWork.SaveChangesAsync();
        }

        return Result<DepartmentModuleDto>.Success(new DepartmentModuleDto
        {
            Id = assignment.Id,
            DepartmentId = assignment.DepartmentId,
            ModuleId = assignment.ModuleId,
            LevelIds = request.LevelIds ?? new List<Guid>(),
            TypeIds = request.TypeIds ?? new List<Guid>()
        });
    }

    public async Task<Result> RemoveAssignmentAsync(Guid assignmentId)
    {
        var assignment = await _unitOfWork.Repository<DepartmentModuleAssignment>().GetByIdAsync(assignmentId);
        if (assignment != null)
        {
            _unitOfWork.Repository<DepartmentModuleAssignment>().Remove(assignment);
            await _unitOfWork.SaveChangesAsync();
        }
        return Result.Success();
    }

    public async Task<Result<PagedList<DepartmentModuleDto>>> GetAssignmentsByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
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
                LevelIds = a.LevelFilters.Select(lf => lf.LevelId).ToList(),
                LevelLabels = a.LevelFilters.Select(lf => lf.Level!.Label).ToList(),
                TypeIds = a.TypeFilters.Select(tf => tf.TypeId).ToList(),
                TypeLabels = a.TypeFilters.Select(tf => tf.Type!.Label).ToList()
            })
            .ToListAsync();
            
        var pagedList = new PagedList<DepartmentModuleDto>(assignments, totalCount, page, pageSize);
        return Result<PagedList<DepartmentModuleDto>>.Success(pagedList);
    }
}

