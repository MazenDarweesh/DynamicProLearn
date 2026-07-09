using LearnDynamicPro.Application.Dtos.Tester;
using LearnDynamicPro.Application.Features.Tester;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LearnDynamicPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "TesterOnly")]
public class TesterController : ControllerBase
{
    private readonly ITesterService _testerService;

    public TesterController(ITesterService testerService)
    {
        _testerService = testerService;
    }

    [HttpGet("versions")]
    public async Task<IActionResult> GetVersions()
    {
        var result = await _testerService.GetAllErpVersionsAsync();
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("versions")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> CreateVersion([FromBody] CreateErpVersionRequest request)
    {
        var result = await _testerService.CreateErpVersionAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpPost("active-version")]
    public async Task<IActionResult> SetActiveVersion([FromBody] SetActiveVersionRequest request)
    {
        var result = await _testerService.SetActiveVersionAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return NoContent();
    }

    [HttpPost("feedback")]
    public async Task<IActionResult> SubmitFeedback([FromBody] SubmitFeedbackRequest request)
    {
        var result = await _testerService.SubmitFeedbackAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }

    [HttpGet("feedback")]
    public async Task<IActionResult> GetFeedbackByVersion()
    {
        var result = await _testerService.GetFeedbackByActiveVersionAsync();
        if (!result.IsSuccess) return BadRequest(result.Error);
        return Ok(result.Value);
    }
}
