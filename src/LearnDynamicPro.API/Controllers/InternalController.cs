using LearnDynamicPro.Application.Dtos.Internal;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/internal")]
public class InternalController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;

    public InternalController(IApplicationDbContext context, Microsoft.Extensions.Configuration.IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    private bool ValidateServiceToken()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return false;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var expectedToken = _configuration["AiCoPilot:ServiceToken"] ?? "default_service_token";
        return token == expectedToken;
    }

    [HttpGet("user-permissions/{userId}")]
    public async Task<IActionResult> GetUserPermissions(Guid userId)
    {
        if (!ValidateServiceToken())
        {
            return Unauthorized(new { message = "Invalid Service Token" });
        }

        var user = await _context.Users
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return NotFound("User not found");

        var permissions = new UserPermissionsDto
        {
            UserId = userId.ToString(),
        };

        // Get modules assigned to this user's department, or all if admin
        if (user.Role == LearnDynamicPro.Domain.Enums.UserRole.Admin)
        {
            var modules = await _context.Modules.ToListAsync();
            foreach (var module in modules)
            {
                permissions.AccessibleModules.Add(new AccessibleModuleDto
                {
                    ModuleId = module.Id.ToString(),
                    LevelFilters = new System.Collections.Generic.List<string>(), // Admin accesses all
                    TypeFilters = new System.Collections.Generic.List<string>()
                });
            }
            
            var units = await _context.Units.Select(u => u.Id.ToString()).ToListAsync();
            permissions.AccessibleUnitIds.AddRange(units);

            var lessons = await _context.Lessons.Select(l => l.Id.ToString()).ToListAsync();
            permissions.AccessibleLessonIds.AddRange(lessons);
        }
        else if (user.DepartmentId.HasValue)
        {
            var assignments = await _context.DepartmentModuleAssignments
                .Include(a => a.Module)
                .ThenInclude(m => m!.Units)
                .ThenInclude(u => u!.Lessons)
                .Include(a => a.LevelFilters)
                .Include(a => a.TypeFilters)
                .Where(a => a.DepartmentId == user.DepartmentId.Value)
                .ToListAsync();

            foreach (var assignment in assignments)
            {
                permissions.AccessibleModules.Add(new AccessibleModuleDto
                {
                    ModuleId = assignment.ModuleId.ToString(),
                    LevelFilters = assignment.LevelFilters.Select(lf => lf.LevelId.ToString()).ToList(),
                    TypeFilters = assignment.TypeFilters.Select(tf => tf.TypeId.ToString()).ToList()
                });

                if (assignment.Module != null)
                {
                    foreach (var unit in assignment.Module.Units)
                    {
                        permissions.AccessibleUnitIds.Add(unit.Id.ToString());
                        foreach (var lesson in unit.Lessons)
                        {
                            permissions.AccessibleLessonIds.Add(lesson.Id.ToString());
                        }
                    }
                }
            }
        }

        return Ok(permissions);
    }

    [HttpGet("lessons/{lessonId}/full-context")]
    public async Task<IActionResult> GetLessonFullContext(Guid lessonId)
    {
        if (!ValidateServiceToken())
        {
            return Unauthorized(new { message = "Invalid Service Token" });
        }

        var lesson = await _context.Lessons
            .Include(l => l.Unit)
            .ThenInclude(u => u!.Module)
            .Include(l => l.Level)
            .Include(l => l.Type)
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson == null) return NotFound("Lesson not found");

        var tenantIds = await _context.DepartmentModuleAssignments
            .Include(a => a.Department)
            .Where(a => lesson.Unit != null && a.ModuleId == lesson.Unit.ModuleId && a.Department != null)
            .Select(a => a.Department!.CompanyId.ToString())
            .Distinct()
            .ToListAsync();

        var context = new
        {
            LessonId = lesson.Id.ToString(),
            LessonTitle = lesson.Title,
            VideoUrl = lesson.VideoUrl,
            PdfUrl = lesson.PdfUrl,
            ExternalLink = lesson.ExternalLink,
            UnitId = lesson.UnitId.ToString(),
            UnitTitle = lesson.Unit?.Name,
            ModuleId = lesson.Unit?.ModuleId.ToString(),
            ModuleTitle = lesson.Unit?.Module?.Name,
            LevelId = lesson.LevelId.ToString(),
            LevelName = lesson.Level?.Label,
            TypeId = lesson.TypeId.ToString(),
            TypeName = lesson.Type?.Label,
            TenantIds = tenantIds,
            TargetRoles = new[] { "Admin", "Student", "Tester" }
        };

        return Ok(context);
    }
}
