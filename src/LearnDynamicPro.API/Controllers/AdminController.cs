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
        => Ok(await _companyService.CreateCompanyAsync(request));

    [HttpGet("companies")]
    public async Task<IActionResult> GetAllCompanies()
        => Ok(await _companyService.GetAllCompaniesAsync());

    // ── Departments ─────────────────────────────────────────────────────────
    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] CreateDepartmentRequest request)
        => Ok(await _companyService.CreateDepartmentAsync(request));

    [HttpGet("companies/{companyId}/departments")]
    public async Task<IActionResult> GetDepartments(Guid companyId)
        => Ok(await _companyService.GetDepartmentsByCompanyAsync(companyId));

    // ── Users ───────────────────────────────────────────────────────────────
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        => Ok(await _companyService.CreateUserAsync(request));

    [HttpGet("departments/{departmentId}/users")]
    public async Task<IActionResult> GetUsers(Guid departmentId)
        => Ok(await _companyService.GetUsersByDepartmentAsync(departmentId));

    // ── Modules ─────────────────────────────────────────────────────────────
    [HttpPost("modules")]
    public async Task<IActionResult> CreateModule([FromBody] CreateModuleRequest request)
        => Ok(await _moduleService.CreateModuleAsync(request));

    [HttpGet("modules")]
    public async Task<IActionResult> GetAllModules()
        => Ok(await _moduleService.GetAllModulesAsync());

    [HttpPost("modules/{id}")]
    public async Task<IActionResult> UpdateModule(Guid id, [FromBody] UpdateModuleRequest request)
        => Ok(await _moduleService.UpdateModuleAsync(id, request));

    [HttpDelete("modules/{id}")]
    public async Task<IActionResult> DeleteModule(Guid id)
    {
        await _moduleService.DeleteModuleAsync(id);
        return NoContent();
    }

    // ── Units ───────────────────────────────────────────────────────────────
    [HttpPost("units")]
    public async Task<IActionResult> CreateUnit([FromBody] CreateUnitRequest request)
        => Ok(await _moduleService.CreateUnitAsync(request));

    [HttpGet("modules/{moduleId}/units")]
    public async Task<IActionResult> GetUnits(Guid moduleId)
        => Ok(await _moduleService.GetUnitsByModuleAsync(moduleId));

    [HttpPost("units/{id}")]
    public async Task<IActionResult> UpdateUnit(Guid id, [FromBody] UpdateUnitRequest request)
        => Ok(await _moduleService.UpdateUnitAsync(id, request));

    [HttpDelete("units/{id}")]
    public async Task<IActionResult> DeleteUnit(Guid id)
    {
        await _moduleService.DeleteUnitAsync(id);
        return NoContent();
    }

    // ── Lessons ─────────────────────────────────────────────────────────────
    [HttpPost("lessons")]
    public async Task<IActionResult> CreateLesson([FromBody] CreateLessonRequest request)
        => Ok(await _moduleService.CreateLessonAsync(request));

    [HttpGet("units/{unitId}/lessons")]
    public async Task<IActionResult> GetLessons(Guid unitId)
        => Ok(await _moduleService.GetLessonsByUnitAsync(unitId));

    [HttpGet("lessons/{lessonId}")]
    public async Task<IActionResult> GetLessonDetail(Guid lessonId)
        => Ok(await _moduleService.GetLessonDetailAsync(lessonId));

    [HttpPost("lessons/{id}")]
    public async Task<IActionResult> UpdateLesson(Guid id, [FromBody] UpdateLessonRequest request)
        => Ok(await _moduleService.UpdateLessonAsync(id, request));

    [HttpDelete("lessons/{id}")]
    public async Task<IActionResult> DeleteLesson(Guid id)
    {
        await _moduleService.DeleteLessonAsync(id);
        return NoContent();
    }

    // ── Assignments ─────────────────────────────────────────────────────────
    [HttpPost("assignments")]
    public async Task<IActionResult> AssignModule([FromBody] AssignModuleRequest request)
        => Ok(await _assignmentService.AssignModuleToDepartmentAsync(request));

    [HttpGet("departments/{departmentId}/assignments")]
    public async Task<IActionResult> GetAssignments(Guid departmentId)
        => Ok(await _assignmentService.GetAssignmentsByDepartmentAsync(departmentId));

    [HttpDelete("assignments/{id}")]
    public async Task<IActionResult> RemoveAssignment(Guid id)
    {
        await _assignmentService.RemoveAssignmentAsync(id);
        return NoContent();
    }
    
    // Note: Progress, Lookups, and ERP Versions management endpoints would also go here.
}
