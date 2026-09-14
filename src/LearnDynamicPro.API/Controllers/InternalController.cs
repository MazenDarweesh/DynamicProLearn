using LearnDynamicPro.Application.Dtos.Internal;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/internal")]
public class InternalController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly Microsoft.Extensions.Configuration.IConfiguration _configuration;
    private readonly IMemoryCache _cache;

    public InternalController(
        IApplicationDbContext context,
        Microsoft.Extensions.Configuration.IConfiguration configuration,
        IMemoryCache cache)
    {
        _context = context;
        _configuration = configuration;
        _cache = cache;
    }

    private bool ValidateServiceToken()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            return false;

        var token = authHeader.Substring("Bearer ".Length).Trim();
        var expectedToken = _configuration["AiCoPilot:ServiceToken"];
        if (string.IsNullOrWhiteSpace(expectedToken))
            return false;

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
            var adminData = await _cache.GetOrCreateAsync("internal_admin_accessible_ids", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                var mIds = await _context.Modules.Select(m => m.Id.ToString()).ToListAsync();
                var uIds = await _context.Units.Select(u => u.Id.ToString()).ToListAsync();
                var lIds = await _context.Lessons.Select(l => l.Id.ToString()).ToListAsync();
                return (ModuleIds: mIds, UnitIds: uIds, LessonIds: lIds);
            });

            if (adminData.ModuleIds != null)
            {
                foreach (var moduleId in adminData.ModuleIds)
                {
                    permissions.AccessibleModules.Add(new AccessibleModuleDto
                    {
                        ModuleId = moduleId,
                        LevelFilters = new List<string>(), // Admin accesses all
                        TypeFilters = new List<string>()
                    });
                }
            }
            
            if (adminData.UnitIds != null)
                permissions.AccessibleUnitIds.AddRange(adminData.UnitIds);

            if (adminData.LessonIds != null)
                permissions.AccessibleLessonIds.AddRange(adminData.LessonIds);
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
