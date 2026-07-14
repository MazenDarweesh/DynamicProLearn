using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Dtos.Tester;
using LearnDynamicPro.Application.Features.Admin;
using LearnDynamicPro.Application.Features.Tester;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    private readonly ICompanyService _companyService;
    private readonly IModuleService _moduleService;
    private readonly IAssignmentService _assignmentService;
    private readonly ITesterService _testerService;
    private readonly IApplicationDbContext _context;

    public AdminController(
        ICompanyService companyService,
        IModuleService moduleService,
        IAssignmentService assignmentService,
        ITesterService testerService,
        IApplicationDbContext context)
    {
        _companyService = companyService;
        _moduleService = moduleService;
        _assignmentService = assignmentService;
        _testerService = testerService;
        _context = context;
    }

    // ── Lookups ─────────────────────────────────────────────────────────────
    [HttpGet("lookups/levels")]
    public async Task<IActionResult> GetLevels()
    {
        var levels = await _context.LevelOptions
            .AsNoTracking()
            .Select(l => new { l.Id, l.Label })
            .ToListAsync();
        return Ok(levels);
    }

    [HttpGet("lookups/types")]
    public async Task<IActionResult> GetTypes()
    {
        var types = await _context.TypeOptions
            .AsNoTracking()
            .Select(t => new { t.Id, t.Label })
            .ToListAsync();
        return Ok(types);
    }

    // ── Companies ───────────────────────────────────────────────────────────
    [HttpPost("companies")]
    public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyRequest request)
    {
        var result = await _companyService.CreateCompanyAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("companies")]
    public async Task<IActionResult> GetAllCompanies([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _companyService.GetAllCompaniesAsync(page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPut("companies/{id}")]
    public async Task<IActionResult> UpdateCompany(Guid id, [FromBody] UpdateCompanyRequest request)
    {
        var result = await _companyService.UpdateCompanyAsync(id, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok();
    }

    [HttpDelete("companies/{id}")]
    public async Task<IActionResult> DeleteCompany(Guid id)
    {
        var result = await _companyService.DeleteCompanyAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    // ── Departments ─────────────────────────────────────────────────────────
    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] CreateDepartmentRequest request)
    {
        var result = await _companyService.CreateDepartmentAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("companies/{companyId}/departments")]
    public async Task<IActionResult> GetDepartments(Guid companyId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _companyService.GetDepartmentsByCompanyAsync(companyId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPut("departments/{id}")]
    public async Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpdateDepartmentRequest request)
    {
        var result = await _companyService.UpdateDepartmentAsync(id, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok();
    }

    [HttpDelete("departments/{id}")]
    public async Task<IActionResult> DeleteDepartment(Guid id)
    {
        var result = await _companyService.DeleteDepartmentAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    [HttpGet("departments/{departmentId}/details")]
    public async Task<IActionResult> GetDepartmentDetails(Guid departmentId)
    {
        var result = await _companyService.GetDepartmentDetailsAsync(departmentId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("departments/{departmentId}/lessons/{lessonId}/mark-complete")]
    public async Task<IActionResult> MarkLessonCompleteForDepartment(Guid departmentId, Guid lessonId)
    {
        var result = await _companyService.MarkLessonCompleteForDepartmentAsync(departmentId, lessonId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("departments/{departmentId}/lessons/{lessonId}/unmark-complete")]
    public async Task<IActionResult> UnmarkLessonCompleteForDepartment(Guid departmentId, Guid lessonId)
    {
        var result = await _companyService.UnmarkLessonCompleteForDepartmentAsync(departmentId, lessonId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    // ── Users ───────────────────────────────────────────────────────────────
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var result = await _companyService.CreateUserAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }
    [HttpPut("users/{userId}")]
    public async Task<IActionResult> UpdateUser(Guid userId, [FromBody] UpdateUserRequest request)
    {
        var result = await _companyService.UpdateUserAsync(userId, request);
        return result.IsSuccess ? Ok(result) : BadRequest(result.Error);
    }

    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        var result = await _companyService.DeleteUserAsync(userId);
        return result.IsSuccess ? Ok(result) : BadRequest(result.Error);
    }

    [HttpGet("users-progress")]
    public async Task<IActionResult> GetAllUsersProgress([FromQuery] Guid? companyId, [FromQuery] Guid? departmentId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _companyService.GetAllUsersProgressAsync(companyId, departmentId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("departments/{departmentId}/users")]
    public async Task<IActionResult> GetUsers(Guid departmentId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _companyService.GetUsersByDepartmentAsync(departmentId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("testers-progress")]
    public async Task<IActionResult> GetTestersProgress([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _companyService.GetAllTestersProgressAsync(page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    // ── Modules ─────────────────────────────────────────────────────────────
    [HttpPost("modules")]
    public async Task<IActionResult> CreateModule([FromBody] CreateModuleRequest request)
    {
        var result = await _moduleService.CreateModuleAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("modules")]
    public async Task<IActionResult> GetAllModules([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _moduleService.GetAllModulesAsync(page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("modules/{id}")]
    public async Task<IActionResult> UpdateModule(Guid id, [FromBody] UpdateModuleRequest request)
    {
        var result = await _moduleService.UpdateModuleAsync(id, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpDelete("modules/{id}")]
    public async Task<IActionResult> DeleteModule(Guid id)
    {
        var result = await _moduleService.DeleteModuleAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    // ── Units ───────────────────────────────────────────────────────────────
    [HttpPost("units")]
    public async Task<IActionResult> CreateUnit([FromBody] CreateUnitRequest request)
    {
        var result = await _moduleService.CreateUnitAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("modules/{moduleId}/units")]
    public async Task<IActionResult> GetUnits(Guid moduleId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _moduleService.GetUnitsByModuleAsync(moduleId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("units/{id}")]
    public async Task<IActionResult> UpdateUnit(Guid id, [FromBody] UpdateUnitRequest request)
    {
        var result = await _moduleService.UpdateUnitAsync(id, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpDelete("units/{id}")]
    public async Task<IActionResult> DeleteUnit(Guid id)
    {
        var result = await _moduleService.DeleteUnitAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    // ── Lessons ─────────────────────────────────────────────────────────────
    [HttpPost("lessons")]
    public async Task<IActionResult> CreateLesson([FromBody] CreateLessonRequest request)
    {
        var result = await _moduleService.CreateLessonAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("units/{unitId}/lessons")]
    public async Task<IActionResult> GetLessons(Guid unitId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _moduleService.GetLessonsByUnitAsync(unitId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("lessons/{lessonId}")]
    public async Task<IActionResult> GetLessonDetail(Guid lessonId)
    {
        var result = await _moduleService.GetLessonDetailAsync(lessonId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("lessons/{id}")]
    public async Task<IActionResult> UpdateLesson(Guid id, [FromBody] UpdateLessonRequest request)
    {
        var result = await _moduleService.UpdateLessonAsync(id, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpDelete("lessons/{id}")]
    public async Task<IActionResult> DeleteLesson(Guid id)
    {
        var result = await _moduleService.DeleteLessonAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    // ── Assignments ─────────────────────────────────────────────────────────
    [HttpPost("assignments")]
    public async Task<IActionResult> AssignModule([FromBody] AssignModuleRequest request)
    {
        var result = await _assignmentService.AssignModuleToDepartmentAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("departments/{departmentId}/assignments")]
    public async Task<IActionResult> GetAssignments(Guid departmentId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _assignmentService.GetAssignmentsByDepartmentAsync(departmentId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpDelete("assignments/{id}")]
    public async Task<IActionResult> RemoveAssignment(Guid id)
    {
        var result = await _assignmentService.RemoveAssignmentAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    // ── Analytics & Progress ────────────────────────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> GetDashboardStats()
    {
        var result = await _companyService.GetDashboardStatsAsync();
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("departments/{departmentId}/users-progress")]
    public async Task<IActionResult> GetDepartmentUsersProgress(Guid departmentId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var result = await _companyService.GetDepartmentUsersProgressAsync(departmentId, page, pageSize);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("users/{id}/details")]
    public async Task<IActionResult> GetUserDetails(Guid id)
    {
        var result = await _companyService.GetUserDetailsAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("testers/{id}/details")]
    public async Task<IActionResult> GetTesterDetails(Guid id)
    {
        var result = await _companyService.GetTesterDetailsAsync(id);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("users/{userId}/lessons/{lessonId}/mark-complete")]
    public async Task<IActionResult> MarkLessonCompleteForUser(Guid userId, Guid lessonId)
    {
        var result = await _companyService.MarkLessonCompleteForUserAsync(userId, lessonId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("users/{userId}/lessons/{lessonId}/unmark-complete")]
    public async Task<IActionResult> UnmarkLessonCompleteForUser(Guid userId, Guid lessonId)
    {
        var result = await _companyService.UnmarkLessonCompleteForUserAsync(userId, lessonId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    // ── Test Cycles ─────────────────────────────────────────────────────────
    [HttpGet("test-cycles")]
    public async Task<IActionResult> GetAllTestCycles()
    {
        var result = await _testerService.GetAllTestCyclesAsync();
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("test-cycles")]
    public async Task<IActionResult> CreateTestCycle([FromBody] CreateTestCycleRequest request)
    {
        var result = await _testerService.CreateTestCycleAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("test-cycles/{testCycleId}/modules")]
    public async Task<IActionResult> AssignModulesToTestCycle(Guid testCycleId, [FromBody] AssignModulesToTestCycleRequest request)
    {
        var result = await _testerService.AssignModulesToTestCycleAsync(testCycleId, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok();
    }

    [HttpPut("test-cycles/{testCycleId}")]
    public async Task<IActionResult> UpdateTestCycle(Guid testCycleId, [FromBody] UpdateTestCycleRequest request)
    {
        var result = await _testerService.UpdateTestCycleAsync(testCycleId, request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok();
    }

    [HttpDelete("test-cycles/{testCycleId}")]
    public async Task<IActionResult> DeleteTestCycle(Guid testCycleId)
    {
        var result = await _testerService.DeleteTestCycleAsync(testCycleId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    // ── Files ───────────────────────────────────────────────────────────────
    [HttpPost("files/upload")]
    public async Task<IActionResult> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest("No file uploaded.");
        
        var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        if (!Directory.Exists(uploadDir)) Directory.CreateDirectory(uploadDir);

        var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
        var filePath = Path.Combine(uploadDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var fileUrl = $"/uploads/{fileName}";
        return Ok(new { fileUrl });
    }
}
