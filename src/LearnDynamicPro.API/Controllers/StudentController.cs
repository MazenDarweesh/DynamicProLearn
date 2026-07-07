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
        var modules = await _studentService.GetAssignedModulesAsync(_currentUserService.UserId);
        return Ok(modules);
    }

    [HttpGet("modules/{moduleId}/units")]
    public async Task<IActionResult> GetUnits(Guid moduleId)
    {
        var units = await _studentService.GetUnitsByModuleAsync(moduleId);
        return Ok(units);
    }

    [HttpGet("units/{unitId}/lessons")]
    public async Task<IActionResult> GetLessons(Guid unitId)
    {
        var lessons = await _studentService.GetLessonsByUnitAsync(unitId, _currentUserService.UserId);
        return Ok(lessons);
    }

    [HttpGet("lessons/{lessonId}")]
    public async Task<IActionResult> GetLessonDetail(Guid lessonId)
    {
        try
        {
            var lesson = await _studentService.GetLessonDetailAsync(lessonId, _currentUserService.UserId);
            return Ok(lesson);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpPost("lessons/{lessonId}/complete")]
    public async Task<IActionResult> CompleteLesson(Guid lessonId, [FromBody] bool isCompleted = true)
    {
        var request = new MarkCompleteRequest { LessonId = lessonId, IsCompleted = isCompleted };
        var result = await _progressService.MarkLessonProgressAsync(request);
        return Ok(result);
    }

    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress()
    {
        var progress = await _progressService.GetUserProgressAsync(_currentUserService.UserId);
        return Ok(progress);
    }
}
