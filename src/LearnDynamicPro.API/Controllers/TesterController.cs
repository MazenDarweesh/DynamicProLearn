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
        var versions = await _testerService.GetAllErpVersionsAsync();
        return Ok(versions);
    }

    [HttpPost("active-version")]
    public async Task<IActionResult> SetActiveVersion([FromBody] SetActiveVersionRequest request)
    {
        await _testerService.SetActiveVersionAsync(request);
        return NoContent();
    }

    [HttpPost("feedback")]
    public async Task<IActionResult> SubmitFeedback([FromBody] SubmitFeedbackRequest request)
    {
        var feedback = await _testerService.SubmitFeedbackAsync(request);
        return Ok(feedback);
    }

    [HttpGet("feedback")]
    public async Task<IActionResult> GetFeedbackByVersion()
    {
        var feedbacks = await _testerService.GetFeedbackByActiveVersionAsync();
        return Ok(feedbacks);
    }
}
