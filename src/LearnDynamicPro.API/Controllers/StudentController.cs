using LearnDynamicPro.Application.Dtos.Progress;
using LearnDynamicPro.Application.Dtos.Student;
using LearnDynamicPro.Application.Features.Progress;
using LearnDynamicPro.Application.Features.Student;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Logging;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "StudentOrAbove")]
public class StudentController : ControllerBase
{
    private readonly IStudentService _studentService;
    private readonly IProgressService _progressService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<StudentController> _logger;

    public StudentController(
        IStudentService studentService,
        IProgressService progressService,
        ICurrentUserService currentUserService,
        ILogger<StudentController> logger)
    {
        _studentService = studentService;
        _progressService = progressService;
        _currentUserService = currentUserService;
        _logger = logger;
    }

    [HttpGet("modules")]
    public async Task<IActionResult> GetAssignedModules()
    {
        var result = await _studentService.GetAssignedModulesAsync(_currentUserService.UserId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("copilot-filters")]
    public async Task<IActionResult> GetCopilotFilters()
    {
        _logger.LogInformation("[StudentAPI] GetCopilotFilters REQUEST | UserId={UserId}", _currentUserService.UserId);
        var result = await _studentService.GetCopilotFiltersAsync(_currentUserService.UserId);
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
    [HttpGet("last-lesson")]
    public async Task<IActionResult> GetLastAccessedLesson()
    {
        var result = await _studentService.GetLastAccessedLessonAsync(_currentUserService.UserId);
        if (!result.IsSuccess) return NotFound(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("modules/{moduleId}/levels")]
    public async Task<IActionResult> GetLessonsByLevel(Guid moduleId)
    {
        var result = await _studentService.GetLessonsByLevelAsync(moduleId, _currentUserService.UserId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("unified-curriculum")]
    public async Task<IActionResult> GetUnifiedCurriculum()
    {
        var result = await _studentService.GetUnifiedStudentCurriculumAsync(_currentUserService.UserId);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("next-lesson")]
    public async Task<IActionResult> GetNextLesson()
    {
        var result = await _studentService.GetNextLessonToLearnAsync(_currentUserService.UserId);
        if (!result.IsSuccess) return NotFound(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("lessons/{lessonId}/quiz")]
    public async Task<IActionResult> GetLessonQuiz(Guid lessonId)
    {
        _logger.LogInformation("[StudentAPI] GetLessonQuiz REQUEST | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);
        var result = await _studentService.GetLessonQuizAsync(lessonId, _currentUserService.UserId);
        if (!result.IsSuccess) 
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
            {
                _logger.LogWarning("[StudentAPI] GetLessonQuiz FORBIDDEN | LessonId={LessonId} UserId={UserId}",
                    lessonId, _currentUserService.UserId);
                return Forbid(result.Error);
            }
            _logger.LogInformation("[StudentAPI] GetLessonQuiz EMPTY/NOT_GENERATED | LessonId={LessonId}", lessonId);
            return Ok(null);
        }
        _logger.LogInformation("[StudentAPI] GetLessonQuiz OK | LessonId={LessonId}", lessonId);
        return Ok(result.Value);
    }

    [HttpGet("lessons/{lessonId}/summary")]
    public async Task<IActionResult> GetLessonSummary(Guid lessonId)
    {
        _logger.LogInformation("[StudentAPI] GetLessonSummary REQUEST | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);
        var result = await _studentService.GetLessonSummaryAsync(lessonId, _currentUserService.UserId);
        if (!result.IsSuccess) 
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
            {
                _logger.LogWarning("[StudentAPI] GetLessonSummary FORBIDDEN | LessonId={LessonId} UserId={UserId}",
                    lessonId, _currentUserService.UserId);
                return Forbid(result.Error);
            }
            _logger.LogInformation("[StudentAPI] GetLessonSummary EMPTY/NOT_GENERATED | LessonId={LessonId}", lessonId);
            return Ok(null);
        }
        _logger.LogInformation("[StudentAPI] GetLessonSummary OK | LessonId={LessonId}", lessonId);
        return Ok(result.Value);
    }

    [HttpGet("lessons/{lessonId}/quiz/state")]
    public async Task<IActionResult> GetQuizState(Guid lessonId)
    {
        _logger.LogInformation("[StudentAPI] GetQuizState REQUEST | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);
        var result = await _studentService.GetQuizStateAsync(lessonId, _currentUserService.UserId);
        if (!result.IsSuccess)
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
            {
                _logger.LogWarning("[StudentAPI] GetQuizState FORBIDDEN | LessonId={LessonId} UserId={UserId}",
                    lessonId, _currentUserService.UserId);
                return Forbid(result.Error);
            }
            _logger.LogWarning("[StudentAPI] GetQuizState NOT_FOUND | LessonId={LessonId}", lessonId);
            return NotFound(result.Error);
        }
        return Ok(result.Value);
    }

    [HttpPost("lessons/{lessonId}/quiz/check-answer")]
    [EnableRateLimiting("QuizInteractionLimit")]
    public async Task<IActionResult> CheckQuizAnswer(Guid lessonId, [FromBody] CheckQuizAnswerRequest request)
    {
        _logger.LogInformation("[StudentAPI] CheckQuizAnswer REQUEST | LessonId={LessonId} QNum={QNum} UserId={UserId}",
            lessonId, request.QuestionNumber, _currentUserService.UserId);
        var result = await _studentService.CheckQuizAnswerAsync(lessonId, request, _currentUserService.UserId);
        if (!result.IsSuccess)
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
                return Forbid(result.Error);
            return BadRequest(result.Error);
        }
        return Ok(result.Value);
    }

    [HttpPost("lessons/{lessonId}/quiz/submit")]
    [EnableRateLimiting("QuizInteractionLimit")]
    public async Task<IActionResult> SubmitQuiz(Guid lessonId, [FromBody] SubmitQuizRequest request)
    {
        _logger.LogInformation("[StudentAPI] SubmitQuiz REQUEST | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);
        var result = await _studentService.SubmitQuizAsync(lessonId, request, _currentUserService.UserId);
        if (!result.IsSuccess)
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
                return Forbid(result.Error);
            return BadRequest(result.Error);
        }
        return Ok(result.Value);
    }

    [HttpPost("lessons/{lessonId}/quiz/reset")]
    [EnableRateLimiting("QuizInteractionLimit")]
    public async Task<IActionResult> ResetQuiz(Guid lessonId)
    {
        _logger.LogInformation("[StudentAPI] ResetQuiz REQUEST | LessonId={LessonId} UserId={UserId}",
            lessonId, _currentUserService.UserId);
        var result = await _studentService.ResetQuizAsync(lessonId, _currentUserService.UserId);
        if (!result.IsSuccess)
        {
            if (result.Error == LearnDynamicPro.Application.Common.AppErrors.Authorization.AccessDenied)
                return Forbid(result.Error);
            return BadRequest(result.Error);
        }
        return Ok(result.Value);
    }
}


