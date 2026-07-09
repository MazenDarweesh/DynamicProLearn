using LearnDynamicPro.Application.Dtos.Assignments;
using LearnDynamicPro.Application.Dtos.Companies;
using LearnDynamicPro.Application.Dtos.Modules;
using LearnDynamicPro.Application.Features.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class AdminController : ControllerBase
{
    private readonly ICompanyService _companyService;
    private readonly IModuleService _moduleService;
    private readonly IAssignmentService _assignmentService;

    public AdminController(
        ICompanyService companyService,
        IModuleService moduleService,
        IAssignmentService assignmentService)
    {
        _companyService = companyService;
        _moduleService = moduleService;
        _assignmentService = assignmentService;
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
    public async Task<IActionResult> GetAllCompanies([FromQuery] int page = 1, [FromQuery] int pageSize = 100)
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
    public async Task<IActionResult> GetDepartments(Guid companyId)
    {
        var result = await _companyService.GetDepartmentsByCompanyAsync(companyId);
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

    // ── Users ───────────────────────────────────────────────────────────────
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var result = await _companyService.CreateUserAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("departments/{departmentId}/users")]
    public async Task<IActionResult> GetUsers(Guid departmentId)
    {
        var result = await _companyService.GetUsersByDepartmentAsync(departmentId);
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
    public async Task<IActionResult> GetAllModules([FromQuery] int page = 1, [FromQuery] int pageSize = 100)
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
    public async Task<IActionResult> GetUnits(Guid moduleId)
    {
        var result = await _moduleService.GetUnitsByModuleAsync(moduleId);
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
    public async Task<IActionResult> GetLessons(Guid unitId)
    {
        var result = await _moduleService.GetLessonsByUnitAsync(unitId);
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
    public async Task<IActionResult> GetAssignments(Guid departmentId)
    {
        var result = await _assignmentService.GetAssignmentsByDepartmentAsync(departmentId);
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
    public async Task<IActionResult> GetUsersProgress(Guid departmentId)
    {
        var result = await _companyService.GetDepartmentUsersProgressAsync(departmentId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }
}
