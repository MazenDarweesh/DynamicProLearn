using LearnDynamicPro.Application.Dtos.Progress;
using LearnDynamicPro.Application.Features.Progress;
using LearnDynamicPro.Application.Features.Student;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "StudentOrAbove")]
public class StudentController : ControllerBase
{
    private readonly IStudentService _studentService;
    private readonly IProgressService _progressService;
    private readonly ICurrentUserService _currentUserService;

    public StudentController(
        IStudentService studentService,
        IProgressService progressService,
        ICurrentUserService currentUserService)
    {
        _studentService = studentService;
        _progressService = progressService;
        _currentUserService = currentUserService;
    }

    [HttpGet("modules")]
    public async Task<IActionResult> GetAssignedModules()
    {
        var result = await _studentService.GetAssignedModulesAsync(_currentUserService.UserId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("modules/{moduleId}/units")]
    public async Task<IActionResult> GetUnits(Guid moduleId)
    {
        var result = await _studentService.GetUnitsByModuleAsync(moduleId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("units/{unitId}/lessons")]
    public async Task<IActionResult> GetLessons(Guid unitId)
    {
        var result = await _studentService.GetLessonsByUnitAsync(unitId, _currentUserService.UserId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("lessons/{lessonId}")]
    public async Task<IActionResult> GetLessonDetail(Guid lessonId)
    {
        var result = await _studentService.GetLessonDetailAsync(lessonId, _currentUserService.UserId);
        if (!result.IsSuccess) 
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
                return Forbid(result.Error);
                
            return NotFound(result.Error);
        }
        return Ok(result.Value);
    }

    [HttpPost("lessons/{lessonId}/complete")]
    public async Task<IActionResult> CompleteLesson(Guid lessonId, [FromBody] bool isCompleted = true)
    {
        var request = new MarkCompleteRequest { LessonId = lessonId, IsCompleted = isCompleted };
        var result = await _progressService.MarkLessonProgressAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress()
    {
        var result = await _progressService.GetUserProgressAsync(_currentUserService.UserId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }
}
