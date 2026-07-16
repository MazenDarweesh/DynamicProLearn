using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Application.Common;
using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using LearnDynamicPro.Application.Interfaces.Repositories;
using LearnDynamicPro.Application.Features.Progress;
using LearnDynamicPro.Application.Dtos.Progress;
using UserProgressDto = LearnDynamicPro.Application.Dtos.Companies.UserProgressDto;

namespace LearnDynamicPro.Application.Features.Admin;

public class CompanyService : ICompanyService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IProgressAnalyticsService _progressAnalytics;
    private readonly ICurrentUserService _currentUserService;

    public CompanyService(IUnitOfWork unitOfWork, IPasswordHasher passwordHasher, IProgressAnalyticsService progressAnalytics, ICurrentUserService currentUserService)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _progressAnalytics = progressAnalytics;
        _currentUserService = currentUserService;
    }

    public async Task<Result<CompanyDto>> CreateCompanyAsync(CreateCompanyRequest request)
    {
        var company = new Company { Name = request.Name };
        await _unitOfWork.Repository<Company>().AddAsync(company);
        await _unitOfWork.SaveChangesAsync();

        return Result<CompanyDto>.Success(new CompanyDto { Id = company.Id, Name = company.Name });
    }

    public async Task<Result<PagedList<CompanyDto>>> GetAllCompaniesAsync(int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Company>().Query().AsNoTracking();
        var totalCount = await query.CountAsync();

        var companies = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new CompanyDto { Id = c.Id, Name = c.Name })
            .ToListAsync();
            
        var pagedList = new PagedList<CompanyDto>(companies, totalCount, page, pageSize);
        return Result<PagedList<CompanyDto>>.Success(pagedList);
    }

    public async Task<Result<DepartmentDto>> CreateDepartmentAsync(CreateDepartmentRequest request)
    {
        var department = new Department 
        { 
            Name = request.Name, 
            CompanyId = request.CompanyId 
        };
        await _unitOfWork.Repository<Department>().AddAsync(department);
        await _unitOfWork.SaveChangesAsync();

        return Result<DepartmentDto>.Success(new DepartmentDto 
        { 
            Id = department.Id, 
            Name = department.Name, 
            CompanyId = department.CompanyId 
        });
    }

    public async Task<Result<PagedList<DepartmentDto>>> GetDepartmentsByCompanyAsync(Guid companyId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<Department>().Query()
            .AsNoTracking()
            .Where(d => d.CompanyId == companyId);
            
        var totalCount = await query.CountAsync();

        var departmentData = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new { d.Id, d.Name, d.CompanyId })
            .ToListAsync();

        var departmentIds = departmentData.Select(d => d.Id).ToList();
        var progressMap = await _progressAnalytics.GetDepartmentsProgressAsync(departmentIds);

        var dtoList = departmentData.Select(d => 
        {
            var p = progressMap.ContainsKey(d.Id) ? progressMap[d.Id] : new ProgressResult();
            return new DepartmentDto 
            { 
                Id = d.Id, 
                Name = d.Name, 
                CompanyId = d.CompanyId,
                CompletedLessons = p.Completed,
                TotalLessons = p.Total,
                ProgressPercentage = p.Percentage
            };
        }).ToList();
            
        var pagedList = new PagedList<DepartmentDto>(dtoList, totalCount, page, pageSize);
        return Result<PagedList<DepartmentDto>>.Success(pagedList);
    }

    public async Task<Result<UserDto>> CreateUserAsync(CreateUserRequest request)
    {
        Department? department = null;

        if (request.DepartmentId.HasValue)
        {
            // Get department to resolve CompanyId if not provided, or to validate it
            department = await _unitOfWork.Repository<Department>().Query()
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == request.DepartmentId.Value);
                
            if (department == null)
                return Result<UserDto>.Failure(AppErrors.General.NotFound);
        }

        var user = new User
        {
            Username = request.Username,
            PasswordHash = _passwordHasher.Hash(request.Password),
            Role = request.Role,
            DepartmentId = department?.Id,
            CompanyId = department?.CompanyId ?? request.CompanyId
        };
        
        await _unitOfWork.Repository<User>().AddAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return Result<UserDto>.Success(new UserDto 
        { 
            Id = user.Id, 
            Username = user.Username, 
            Role = user.Role, 
            DepartmentId = user.DepartmentId,
            CompanyId = user.CompanyId 
        });
    }

    public async Task<Result<PagedList<UserDto>>> GetUsersByDepartmentAsync(Guid departmentId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.DepartmentId == departmentId);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new UserDto 
            { 
                Id = u.Id, 
                Username = u.Username, 
                Role = u.Role, 
                DepartmentId = u.DepartmentId,
                CompanyId = u.CompanyId 
            })
            .ToListAsync();
            
        var pagedList = new PagedList<UserDto>(users, totalCount, page, pageSize);
        return Result<PagedList<UserDto>>.Success(pagedList);
    }

    public async Task<Result<bool>> UpdateUserAsync(Guid id, UpdateUserRequest request)
    {
        var user = await _unitOfWork.Repository<User>().GetByIdAsync(id);
        if (user == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        // Verify new department belongs to new company only if provided
        if (request.DepartmentId.HasValue || request.CompanyId.HasValue)
        {
            if (!request.DepartmentId.HasValue || !request.CompanyId.HasValue)
                return Result<bool>.Failure(AppErrors.General.ValidationFailed);

            var department = await _unitOfWork.Repository<Department>().GetByIdAsync(request.DepartmentId.Value);
            if (department == null || department.CompanyId != request.CompanyId.Value)
                return Result<bool>.Failure(AppErrors.General.ValidationFailed);
        }

        if (!string.IsNullOrWhiteSpace(request.Username))
            user.Username = request.Username;
            
        user.CompanyId = request.CompanyId;
        user.DepartmentId = request.DepartmentId;
        
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = _passwordHasher.Hash(request.Password);
        }

        _unitOfWork.Repository<User>().Update(user);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteUserAsync(Guid id)
    {
        try
        {
            Console.WriteLine($"[BACKEND] Executing DeleteUserAsync for UserId: {id}");
            var user = await _unitOfWork.Repository<User>().GetByIdAsync(id);
            if (user == null)
                return Result<bool>.Failure(AppErrors.General.NotFound);

            // Remove MarkedByUserId from any LessonProgress to avoid NoAction constraint error if user is an admin
            var markedProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
                .Where(lp => lp.MarkedByUserId == id)
                .ToListAsync();
            foreach (var p in markedProgresses)
            {
                p.MarkedByUserId = null;
                _unitOfWork.Repository<LessonProgress>().Update(p);
            }

            // Manually delete LessonProgresses
            var userProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
                .Where(lp => lp.UserId == id)
                .ToListAsync();
            if (userProgresses.Any())
            {
                _unitOfWork.Repository<LessonProgress>().RemoveRange(userProgresses);
            }

            // Manually delete Feedbacks
            var feedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
                .Where(tf => tf.UserId == id)
                .ToListAsync();
            if (feedbacks.Any())
            {
                _unitOfWork.Repository<TesterFeedback>().RemoveRange(feedbacks);
            }

            // Manually delete Active Version
            var activeVersion = await _unitOfWork.Repository<TesterActiveVersion>().Query()
                .FirstOrDefaultAsync(tav => tav.UserId == id);
            if (activeVersion != null)
            {
                _unitOfWork.Repository<TesterActiveVersion>().Remove(activeVersion);
            }

            _unitOfWork.Repository<User>().Remove(user);
            await _unitOfWork.SaveChangesAsync();
            Console.WriteLine($"[BACKEND] Successfully deleted UserId: {id}");
            return Result<bool>.Success(true);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[BACKEND] Error deleting UserId {id}: {ex.Message}");
            if (ex.InnerException != null)
                Console.WriteLine($"[BACKEND] Inner Exception: {ex.InnerException.Message}");

            var inner = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
            System.IO.File.WriteAllText("delete_error_user.txt", inner);
            throw;
        }
    }

    public async Task<Result<bool>> UpdateCompanyAsync(Guid id, UpdateCompanyRequest request)
    {
        var company = await _unitOfWork.Repository<Company>().GetByIdAsync(id);
        if (company == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        company.Name = request.Name;
        _unitOfWork.Repository<Company>().Update(company);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteCompanyAsync(Guid id)
    {
        try
        {
            Console.WriteLine($"[BACKEND] Executing DeleteCompanyAsync for CompanyId: {id}");
            var company = await _unitOfWork.Repository<Company>().Query()
                .Include(c => c.Users)
                .Include(c => c.Departments)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (company == null)
                return Result<bool>.Failure(AppErrors.General.NotFound);

            if (company.Users.Any())
            {
                var userIds = company.Users.Select(u => u.Id).ToList();
                var markedProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
                    .Where(lp => lp.MarkedByUserId.HasValue && userIds.Contains(lp.MarkedByUserId.Value))
                    .ToListAsync();
                foreach (var p in markedProgresses)
                {
                    p.MarkedByUserId = null;
                    _unitOfWork.Repository<LessonProgress>().Update(p);
                }
                
                // ALSO delete LessonProgresses for these users manually, just in case Cascade is off in DB
                var userProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
                    .Where(lp => userIds.Contains(lp.UserId))
                    .ToListAsync();
                if (userProgresses.Any())
                {
                    _unitOfWork.Repository<LessonProgress>().RemoveRange(userProgresses);
                }

                // Delete Tester Feedbacks
                var feedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
                    .Where(tf => userIds.Contains(tf.UserId))
                    .ToListAsync();
                if (feedbacks.Any())
                {
                    _unitOfWork.Repository<TesterFeedback>().RemoveRange(feedbacks);
                }

                // Delete Tester Active Versions
                var activeVersions = await _unitOfWork.Repository<TesterActiveVersion>().Query()
                    .Where(tav => userIds.Contains(tav.UserId))
                    .ToListAsync();
                if (activeVersions.Any())
                {
                    _unitOfWork.Repository<TesterActiveVersion>().RemoveRange(activeVersions);
                }

                _unitOfWork.Repository<User>().RemoveRange(company.Users);
            }

            if (company.Departments.Any())
            {
                var deptIds = company.Departments.Select(d => d.Id).ToList();
                var assignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
                    .Where(a => deptIds.Contains(a.DepartmentId))
                    .ToListAsync();
                if (assignments.Any())
                {
                    _unitOfWork.Repository<DepartmentModuleAssignment>().RemoveRange(assignments);
                }

                _unitOfWork.Repository<Department>().RemoveRange(company.Departments);
            }

            _unitOfWork.Repository<Company>().Remove(company);
            await _unitOfWork.SaveChangesAsync();
            Console.WriteLine($"[BACKEND] Successfully deleted CompanyId: {id}");
            return Result<bool>.Success(true);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[BACKEND] Error deleting CompanyId {id}: {ex.Message}");
            if (ex.InnerException != null)
                Console.WriteLine($"[BACKEND] Inner Exception: {ex.InnerException.Message}");
                
            var inner = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
            System.IO.File.WriteAllText("delete_error.txt", inner);
            throw;
        }
    }

    public async Task<Result<bool>> UpdateDepartmentAsync(Guid id, UpdateDepartmentRequest request)
    {
        var department = await _unitOfWork.Repository<Department>().GetByIdAsync(id);
        if (department == null)
            return Result<bool>.Failure(AppErrors.General.NotFound);

        department.Name = request.Name;
        _unitOfWork.Repository<Department>().Update(department);
        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> DeleteDepartmentAsync(Guid id)
    {
        try
        {
            var department = await _unitOfWork.Repository<Department>().Query()
                .Include(d => d.Users)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (department == null)
                return Result<bool>.Failure(AppErrors.General.NotFound);

            if (department.Users.Any())
            {
                var userIds = department.Users.Select(u => u.Id).ToList();
                var markedProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
                    .Where(lp => lp.MarkedByUserId.HasValue && userIds.Contains(lp.MarkedByUserId.Value))
                    .ToListAsync();
                foreach (var p in markedProgresses)
                {
                    p.MarkedByUserId = null;
                    _unitOfWork.Repository<LessonProgress>().Update(p);
                }

                var userProgresses = await _unitOfWork.Repository<LessonProgress>().Query()
                    .Where(lp => userIds.Contains(lp.UserId))
                    .ToListAsync();
                if (userProgresses.Any())
                {
                    _unitOfWork.Repository<LessonProgress>().RemoveRange(userProgresses);
                }

                var feedbacks = await _unitOfWork.Repository<TesterFeedback>().Query()
                    .Where(tf => userIds.Contains(tf.UserId))
                    .ToListAsync();
                if (feedbacks.Any())
                {
                    _unitOfWork.Repository<TesterFeedback>().RemoveRange(feedbacks);
                }

                var activeVersions = await _unitOfWork.Repository<TesterActiveVersion>().Query()
                    .Where(tav => userIds.Contains(tav.UserId))
                    .ToListAsync();
                if (activeVersions.Any())
                {
                    _unitOfWork.Repository<TesterActiveVersion>().RemoveRange(activeVersions);
                }

                _unitOfWork.Repository<User>().RemoveRange(department.Users);
            }

            // Also remove assignments
            var assignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
                .Where(a => a.DepartmentId == id)
                .ToListAsync();
            if (assignments.Any())
            {
                _unitOfWork.Repository<DepartmentModuleAssignment>().RemoveRange(assignments);
            }

            _unitOfWork.Repository<Department>().Remove(department);
            await _unitOfWork.SaveChangesAsync();
            return Result<bool>.Success(true);
        }
        catch (Exception ex)
        {
            var inner = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
            System.IO.File.WriteAllText("delete_error_dept.txt", inner);
            throw;
        }
    }

    public async Task<Result<DepartmentDetailsDto>> GetDepartmentDetailsAsync(Guid departmentId)
    {
        var department = await _unitOfWork.Repository<Department>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == departmentId);

        if (department == null)
            return Result<DepartmentDetailsDto>.Failure(AppErrors.General.NotFound);

        var totalUsers = await _unitOfWork.Repository<User>().Query()
            .CountAsync(u => u.DepartmentId == departmentId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester);

        var userIds = await _unitOfWork.Repository<User>().Query()
            .Where(u => u.DepartmentId == departmentId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
            .Select(u => u.Id)
            .ToListAsync();

        // Fetch assignments with their level/type filters
        var rawAssignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.DepartmentId == departmentId && !a.IsDeleted)
            .Select(a => new
            {
                AssignmentId = a.Id,
                ModuleId = a.ModuleId,
                ModuleName = a.Module!.Name,
                FilterLevelIds = a.LevelFilters.Where(lf => !lf.IsDeleted).Select(lf => lf.LevelId).ToList(),
                FilterTypeIds = a.TypeFilters.Where(tf => !tf.IsDeleted).Select(tf => tf.TypeId).ToList(),
                Units = a.Module.Units!.OrderBy(u => u.OrderIndex).Select(u => new
                {
                    UnitId = u.Id,
                    UnitName = u.Name,
                    UnitOrderIndex = u.OrderIndex,
                    Lessons = u.Lessons!.OrderBy(l => l.OrderIndex).Select(l => new
                    {
                        LessonId = l.Id,
                        LessonName = l.Title,
                        LevelId = l.LevelId,
                        TypeId = l.TypeId
                    }).ToList()
                }).ToList()
            })
            .ToListAsync();

        // Apply level/type filters to lessons per assignment and eliminate duplicates
        var assignments = rawAssignments
            .GroupBy(a => a.ModuleId)
            .Select(g => g.Last()) // In case of DB duplicates, take the latest one
            .Select(a =>
        {
            var hasLevelFilter = a.FilterLevelIds.Any();
            var hasTypeFilter = a.FilterTypeIds.Any();

            var filteredUnits = a.Units.Select(u => new
            {
                u.UnitId,
                u.UnitName,
                u.UnitOrderIndex,
                Lessons = u.Lessons.Where(l =>
                {
                    // If levels selected, lesson must match one of them
                    bool levelMatch = !hasLevelFilter || a.FilterLevelIds.Contains(l.LevelId);
                    // If types selected, lesson must match one of them
                    bool typeMatch = !hasTypeFilter || a.FilterTypeIds.Contains(l.TypeId);
                    return levelMatch && typeMatch;
                }).ToList()
            }).Where(u => u.Lessons.Any()).ToList();

            return new
            {
                a.ModuleId,
                a.ModuleName,
                Units = filteredUnits
            };
        }).Where(m => m.Units.Any()).ToList();

        var assignedLessonIds = assignments.SelectMany(m => m.Units.SelectMany(u => u.Lessons.Select(l => l.LessonId))).ToList();

        var completions = new List<LessonProgress>();
        if (userIds.Any() && assignedLessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && userIds.Contains(p.UserId) && assignedLessonIds.Contains(p.LessonId))
                .ToListAsync();
        }

        var result = new DepartmentDetailsDto
        {
            DepartmentId = department.Id,
            DepartmentName = department.Name,
            TotalUsers = totalUsers,
            Modules = assignments.Select(m => new DepartmentModuleProgressDto
            {
                ModuleId = m.ModuleId,
                Name = m.ModuleName,
                TotalLessons = m.Units.SelectMany(u => u.Lessons).Count(),
                CompletedLessons = m.Units.SelectMany(u => u.Lessons).Count(l =>
                    userIds.Any() && userIds.All(uid => completions.Any(c => c.UserId == uid && c.LessonId == l.LessonId))
                ),
                Units = m.Units.Select(u => new DepartmentUnitProgressDto
                {
                    UnitId = u.UnitId,
                    Name = u.UnitName,
                    Lessons = u.Lessons.Select(l => new DepartmentLessonProgressDto
                    {
                        LessonId = l.LessonId,
                        Name = l.LessonName,
                        TotalUsersCount = totalUsers,
                        CompletedUsersCount = completions.Count(c => c.LessonId == l.LessonId && userIds.Contains(c.UserId))
                    }).ToList()
                }).ToList()
            }).ToList()
        };

        return Result<DepartmentDetailsDto>.Success(result);
    }

    public async Task<Result<UserDetailsDto>> GetUserDetailsAsync(Guid userId)
    {
        var user = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        if (user == null)
            return Result<UserDetailsDto>.Failure(AppErrors.General.NotFound);

        var rawAssignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.DepartmentId == user.DepartmentId && !a.IsDeleted)
            .Select(a => new 
            {
                ModuleId = a.ModuleId,
                ModuleName = a.Module!.Name,
                FilterLevelIds = a.LevelFilters.Where(lf => !lf.IsDeleted).Select(lf => lf.LevelId).ToList(),
                FilterTypeIds = a.TypeFilters.Where(tf => !tf.IsDeleted).Select(tf => tf.TypeId).ToList(),
                Units = a.Module.Units!.OrderBy(u => u.OrderIndex).Select(u => new 
                {
                    UnitId = u.Id,
                    UnitName = u.Name,
                    UnitOrderIndex = u.OrderIndex,
                    Lessons = u.Lessons!.OrderBy(l => l.OrderIndex).Select(l => new 
                    {
                        LessonId = l.Id,
                        LessonName = l.Title,
                        LevelId = l.LevelId,
                        TypeId = l.TypeId
                    }).ToList()
                }).ToList()
            })
            .ToListAsync();

        var assignments = rawAssignments
            .GroupBy(a => a.ModuleId)
            .Select(g => g.Last())
            .Select(a =>
            {
                bool hasLevelFilter = a.FilterLevelIds.Any();
                bool hasTypeFilter = a.FilterTypeIds.Any();

                var filteredUnits = a.Units.Select(u => new
                {
                    u.UnitId,
                    u.UnitName,
                    Lessons = u.Lessons.Where(l =>
                    {
                        bool levelMatch = !hasLevelFilter || a.FilterLevelIds.Contains(l.LevelId);
                        bool typeMatch = !hasTypeFilter || a.FilterTypeIds.Contains(l.TypeId);
                        return levelMatch && typeMatch;
                    }).Select(l => new 
                    {
                        l.LessonId,
                        l.LessonName
                    }).ToList()
                }).Where(u => u.Lessons.Any()).ToList();

                return new
                {
                    a.ModuleId,
                    a.ModuleName,
                    Units = filteredUnits
                };
            }).Where(m => m.Units.Any()).ToList();

        var assignedLessonIds = assignments.SelectMany(m => m.Units.SelectMany(u => u.Lessons.Select(l => l.LessonId))).ToList();

        var completions = new List<Guid>();
        if (assignedLessonIds.Any())
        {
            completions = await _unitOfWork.Repository<LessonProgress>().Query()
                .AsNoTracking()
                .Where(p => p.IsCompleted && p.UserId == userId && assignedLessonIds.Contains(p.LessonId))
                .Select(p => p.LessonId)
                .ToListAsync();
        }

        var result = new UserDetailsDto
        {
            UserId = user.Id,
            UserName = user.Username,
            DepartmentId = user.DepartmentId,
            TotalAssignedLessons = assignedLessonIds.Count,
            TotalCompletedLessons = completions.Count,
            Modules = assignments.Select(m => new UserModuleProgressDto
            {
                ModuleId = m.ModuleId,
                Name = m.ModuleName,
                TotalLessons = m.Units.SelectMany(u => u.Lessons).Count(),
                CompletedLessons = m.Units.SelectMany(u => u.Lessons).Count(l => completions.Contains(l.LessonId)),
                Units = m.Units.Select(u => new UserUnitProgressDto
                {
                    UnitId = u.UnitId,
                    Name = u.UnitName,
                    Lessons = u.Lessons.Select(l => new UserLessonProgressDto
                    {
                        LessonId = l.LessonId,
                        Name = l.LessonName,
                        IsCompleted = completions.Contains(l.LessonId)
                    }).ToList()
                }).ToList()
            }).ToList()
        };

        return Result<UserDetailsDto>.Success(result);
    }

    public async Task<Result<bool>> MarkLessonCompleteForUserAsync(Guid userId, Guid lessonId)
    {
        var adminId = _currentUserService.UserId;
        if (adminId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        var existing = await _unitOfWork.Repository<LessonProgress>().Query()
            .FirstOrDefaultAsync(p => p.LessonId == lessonId && p.UserId == userId);

        if (existing == null)
        {
            await _unitOfWork.Repository<LessonProgress>().AddAsync(new LessonProgress
            {
                UserId = userId,
                LessonId = lessonId,
                IsCompleted = true,
                CompletedAt = DateTime.UtcNow,
                CompletionSource = LearnDynamicPro.Domain.Enums.CompletionSource.AdminOverride,
                MarkedByUserId = adminId
            });
        }
        else if (!existing.IsCompleted)
        {
            existing.IsCompleted = true;
            existing.CompletedAt = DateTime.UtcNow;
            existing.CompletionSource = LearnDynamicPro.Domain.Enums.CompletionSource.AdminOverride;
            existing.MarkedByUserId = adminId;
            _unitOfWork.Repository<LessonProgress>().Update(existing);
        }

        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> UnmarkLessonCompleteForUserAsync(Guid userId, Guid lessonId)
    {
        var adminId = _currentUserService.UserId;
        if (adminId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        var existing = await _unitOfWork.Repository<LessonProgress>().Query()
            .FirstOrDefaultAsync(p => p.LessonId == lessonId && p.UserId == userId);

        if (existing != null && existing.IsCompleted)
        {
            existing.IsCompleted = false;
            existing.CompletedAt = null;
            existing.MarkedByUserId = adminId;
            _unitOfWork.Repository<LessonProgress>().Update(existing);
        }

        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> MarkLessonCompleteForDepartmentAsync(Guid departmentId, Guid lessonId)
    {
        var adminId = _currentUserService.UserId;
        if (adminId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        var userIds = await _unitOfWork.Repository<User>().Query()
            .Where(u => u.DepartmentId == departmentId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
            .Select(u => u.Id)
            .ToListAsync();

        if (!userIds.Any())
            return Result<bool>.Success(true);

        var existingCompletions = await _unitOfWork.Repository<LessonProgress>().Query()
            .Where(p => p.LessonId == lessonId && userIds.Contains(p.UserId))
            .ToListAsync();

        foreach (var userId in userIds)
        {
            var existing = existingCompletions.FirstOrDefault(p => p.UserId == userId);
            if (existing == null)
            {
                await _unitOfWork.Repository<LessonProgress>().AddAsync(new LessonProgress
                {
                    UserId = userId,
                    LessonId = lessonId,
                    IsCompleted = true,
                    CompletedAt = DateTime.UtcNow,
                    CompletionSource = LearnDynamicPro.Domain.Enums.CompletionSource.AdminOverride,
                    MarkedByUserId = adminId
                });
            }
            else if (!existing.IsCompleted)
            {
                existing.IsCompleted = true;
                existing.CompletedAt = DateTime.UtcNow;
                existing.CompletionSource = LearnDynamicPro.Domain.Enums.CompletionSource.AdminOverride;
                existing.MarkedByUserId = adminId;
                _unitOfWork.Repository<LessonProgress>().Update(existing);
            }
        }

        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> UnmarkLessonCompleteForDepartmentAsync(Guid departmentId, Guid lessonId)
    {
        var adminId = _currentUserService.UserId;
        if (adminId == Guid.Empty)
            return Result<bool>.Failure(AppErrors.Authorization.AccessDenied);

        var userIds = await _unitOfWork.Repository<User>().Query()
            .Where(u => u.DepartmentId == departmentId && u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester)
            .Select(u => u.Id)
            .ToListAsync();

        if (!userIds.Any())
            return Result<bool>.Success(true);

        var existingCompletions = await _unitOfWork.Repository<LessonProgress>().Query()
            .Where(p => p.LessonId == lessonId && userIds.Contains(p.UserId) && p.IsCompleted)
            .ToListAsync();

        foreach (var existing in existingCompletions)
        {
            existing.IsCompleted = false;
            existing.CompletedAt = null;
            existing.MarkedByUserId = adminId;
            _unitOfWork.Repository<LessonProgress>().Update(existing);
        }

        await _unitOfWork.SaveChangesAsync();
        return Result<bool>.Success(true);
    }

    public async Task<Result<PagedList<UserProgressDto>>> GetDepartmentUsersProgressAsync(Guid departmentId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.DepartmentId == departmentId);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new 
            {
                Id = u.Id,
                Username = u.Username,
                Role = u.Role
            })
            .ToListAsync();

        var assignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => a.DepartmentId == departmentId && !a.IsDeleted)
            .Select(a => new 
            {
                ModuleName = a.Module != null ? a.Module.Name : ""
            })
            .ToListAsync();

        var assignedModulesNames = string.Join(", ", assignments.Select(a => a.ModuleName));
        var userIds = users.Select(u => u.Id).ToList();
        var progressMap = await _progressAnalytics.GetUsersProgressAsync(userIds);

        var progressList = users.Select(u => {
            var p = progressMap.ContainsKey(u.Id) ? progressMap[u.Id] : new ProgressResult();
            return new UserProgressDto
            {
                UserId = u.Id,
                UserName = u.Username,
                Role = u.Role.ToString(),
                AssignedModules = string.IsNullOrEmpty(assignedModulesNames) ? "لا يوجد" : assignedModulesNames,
                CompletedLessons = p.Completed,
                TotalLessons = p.Total
            };
        }).ToList();

        var pagedList = new PagedList<UserProgressDto>(progressList, totalCount, page, pageSize);
        return Result<PagedList<UserProgressDto>>.Success(pagedList);
    }

    public async Task<Result<PagedList<UserProgressDto>>> GetAllUsersProgressAsync(Guid? companyId, Guid? departmentId, int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester);

        if (companyId.HasValue && companyId.Value != Guid.Empty)
            query = query.Where(u => u.CompanyId == companyId.Value);

        if (departmentId.HasValue && departmentId.Value != Guid.Empty)
            query = query.Where(u => u.DepartmentId == departmentId.Value);

        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new 
            {
                Id = u.Id,
                Username = u.Username,
                Role = u.Role,
                CompanyId = u.CompanyId,
                CompanyName = u.Company!.Name,
                DepartmentId = u.DepartmentId,
                DepartmentName = u.Department!.Name
            })
            .ToListAsync();

        var depIds = users.Select(u => u.DepartmentId).Distinct().ToList();

        var assignments = await _unitOfWork.Repository<DepartmentModuleAssignment>().Query()
            .AsNoTracking()
            .Where(a => depIds.Contains(a.DepartmentId) && !a.IsDeleted)
            .Select(a => new 
            {
                DepartmentId = a.DepartmentId,
                ModuleName = a.Module != null ? a.Module.Name : ""
            })
            .ToListAsync();

        var userIds = users.Select(u => u.Id).ToList();
        var progressMap = await _progressAnalytics.GetUsersProgressAsync(userIds);

        var progressList = users.Select(u => {
            var p = progressMap.ContainsKey(u.Id) ? progressMap[u.Id] : new ProgressResult();
            var userAssignments = assignments.Where(a => a.DepartmentId == u.DepartmentId).ToList();
            var assignedModulesNames = string.Join(", ", userAssignments.Select(a => a.ModuleName));

            return new UserProgressDto
            {
                UserId = u.Id,
                UserName = u.Username,
                Role = u.Role.ToString(),
                CompanyId = u.CompanyId,
                CompanyName = u.CompanyName,
                DepartmentId = u.DepartmentId,
                DepartmentName = u.DepartmentName,
                AssignedModules = string.IsNullOrEmpty(assignedModulesNames) ? "لا يوجد" : assignedModulesNames,
                CompletedLessons = p.Completed,
                TotalLessons = p.Total
            };
        }).ToList();

        var pagedList = new PagedList<UserProgressDto>(progressList, totalCount, page, pageSize);
        return Result<PagedList<UserProgressDto>>.Success(pagedList);
    }

    public async Task<Result<PagedList<UserProgressDto>>> GetAllTestersProgressAsync(int page = 1, int pageSize = 10)
    {
        var query = _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester);
            
        var totalCount = await query.CountAsync();

        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new 
            {
                Id = u.Id,
                Username = u.Username,
                Role = u.Role,
                DepartmentId = u.DepartmentId
            })
            .ToListAsync();

        var userIds = users.Select(u => u.Id).ToList();

        var testCycles = await _unitOfWork.Repository<TestCycle>().Query()
            .AsNoTracking()
            .Where(tc => userIds.Contains(tc.TesterId))
            .Select(tc => new
            {
                TesterId = tc.TesterId,
                Modules = tc.AssignedModules.Select(am => am.Module != null ? am.Module.Name : "")
            })
            .ToListAsync();

        var progressMap = await _progressAnalytics.GetUsersProgressAsync(userIds);

        var progressList = users.Select(u => {
            var userCycles = testCycles.Where(tc => tc.TesterId == u.Id).ToList();
            var assignedModulesNames = string.Join(", ", userCycles.SelectMany(tc => tc.Modules).Distinct());
            var p = progressMap.ContainsKey(u.Id) ? progressMap[u.Id] : new ProgressResult();

            return new UserProgressDto
            {
                UserId = u.Id,
                UserName = u.Username,
                Role = u.Role.ToString(),
                AssignedModules = string.IsNullOrEmpty(assignedModulesNames) ? "لا يوجد" : assignedModulesNames,
                CompletedLessons = p.Completed,
                TotalLessons = p.Total
            };
        }).ToList();

        var pagedList = new PagedList<UserProgressDto>(progressList, totalCount, page, pageSize);
        return Result<PagedList<UserProgressDto>>.Success(pagedList);
    }

    public async Task<Result<DashboardStatsDto>> GetDashboardStatsAsync()
    {
        var totalCompanies = await _unitOfWork.Repository<Company>().Query().CountAsync();
        var activeUsers = await _unitOfWork.Repository<User>().Query().CountAsync(u => u.Role != LearnDynamicPro.Domain.Enums.UserRole.Tester);
        var activeTesters = await _unitOfWork.Repository<User>().Query().CountAsync(u => u.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester);
        var publishedModules = await _unitOfWork.Repository<Module>().Query().CountAsync();

        var p = await _progressAnalytics.GetOverallSystemProgressAsync();

        return Result<DashboardStatsDto>.Success(new DashboardStatsDto
        {
            TotalCompanies = totalCompanies,
            ActiveUsers = activeUsers,
            ActiveTesters = activeTesters,
            PublishedModules = publishedModules,
            AverageProgress = p.Percentage
        });
    }

    public async Task<Result<LearnDynamicPro.Application.DTOs.Tester.TesterDetailsDto>> GetTesterDetailsAsync(Guid testerId)
    {
        var tester = await _unitOfWork.Repository<User>().Query()
            .AsNoTracking()
            .Where(u => u.Id == testerId && u.Role == LearnDynamicPro.Domain.Enums.UserRole.Tester)
            .Select(u => new { u.Id, u.Username })
            .FirstOrDefaultAsync();

        if (tester == null)
            return Result<LearnDynamicPro.Application.DTOs.Tester.TesterDetailsDto>.Failure(AppErrors.General.NotFound);

        // Optimize: Project only necessary hierarchy data to avoid large joins and cartesian explosion
        var assignedHierarchy = await _unitOfWork.Repository<TestCycle>().Query()
            .AsNoTracking()
            .Where(tc => tc.TesterId == testerId)
            .SelectMany(tc => tc.AssignedModules)
            .Where(am => am.Module != null)
            .Select(am => new
            {
                ModuleName = am.Module!.Name,
                Units = am.Module.Units!.Select(u => new
                {
                    UnitName = u.Name,
                    Lessons = u.Lessons!.Select(l => new
                    {
                        LessonId = l.Id,
                        LessonName = l.Title
                    }).ToList()
                }).ToList()
            })
            .ToListAsync();

        var allLessonsCount = assignedHierarchy.SelectMany(m => m.Units).SelectMany(u => u.Lessons).Count();

        // Optimize: Fetch Progress and Feedback mapped by LessonId
        // Dictionary lookup is O(1), preventing O(N*M) inside the loops
        var progressesDict = await _unitOfWork.Repository<LessonProgress>().Query()
            .AsNoTracking()
            .Where(p => p.UserId == testerId)
            .Select(p => new { p.LessonId, p.IsCompleted, p.CompletedAt })
            .ToDictionaryAsync(p => p.LessonId);

        var feedbacksDict = await _unitOfWork.Repository<TesterFeedback>().Query()
            .AsNoTracking()
            .Where(f => f.UserId == testerId)
            .Select(f => new 
            { 
                f.LessonId, 
                Label = f.ConditionOption != null ? f.ConditionOption.Label : "تم التقييم",
                f.Notes,
                f.CreatedAt
            })
            .ToDictionaryAsync(f => f.LessonId);

        int completedCount = progressesDict.Values.Count(p => p.IsCompleted);
        int totalAssigned = allLessonsCount;
        int progressPercent = totalAssigned > 0 ? (int)Math.Round((double)completedCount / totalAssigned * 100) : 0;

        var feedbacksDto = new List<LearnDynamicPro.Application.DTOs.Tester.TesterLessonFeedbackDto>();

        foreach (var module in assignedHierarchy)
        {
            foreach (var unit in module.Units)
            {
                foreach (var lesson in unit.Lessons)
                {
                    progressesDict.TryGetValue(lesson.LessonId, out var progress);
                    feedbacksDict.TryGetValue(lesson.LessonId, out var feedback);
                    
                    var status = "غير مختبر";
                    if (progress != null && progress.IsCompleted) status = "مكتمل";
                    if (feedback != null) status = feedback.Label;

                    feedbacksDto.Add(new LearnDynamicPro.Application.DTOs.Tester.TesterLessonFeedbackDto
                    {
                        ModuleName = module.ModuleName,
                        UnitName = unit.UnitName,
                        LessonName = lesson.LessonName,
                        Status = status,
                        Comment = feedback?.Notes,
                        EvaluationDate = feedback?.CreatedAt ?? progress?.CompletedAt
                    });
                }
            }
        }

        var result = new LearnDynamicPro.Application.DTOs.Tester.TesterDetailsDto
        {
            Id = tester.Id.ToString(),
            Name = tester.Username,
            Email = tester.Username + "@dynamic.com", // Replace with actual email if exists
            TotalAssignedLessons = totalAssigned,
            CompletedLessons = completedCount,
            ProgressPercent = progressPercent,
            Feedbacks = feedbacksDto.OrderByDescending(f => f.EvaluationDate).ToList()
        };

        return Result<LearnDynamicPro.Application.DTOs.Tester.TesterDetailsDto>.Success(result);
    }
}

