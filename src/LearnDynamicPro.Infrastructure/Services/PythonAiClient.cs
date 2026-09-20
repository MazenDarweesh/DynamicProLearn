using System.Diagnostics;
using System.Net.Http.Json;
using LearnDynamicPro.Application.Dtos.Internal;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LearnDynamicPro.Infrastructure.Services;

public class PythonAiClient : IPythonAiClient
{
    private readonly HttpClient _httpClient;
    private readonly string _serviceToken;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ITokenService _tokenService;
    private readonly ICurrentUserService _currentUserService;
    private readonly ILogger<PythonAiClient> _logger;

    public PythonAiClient(
        HttpClient httpClient,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ITokenService tokenService,
        ICurrentUserService currentUserService,
        ILogger<PythonAiClient> logger)
    {
        _httpClient = httpClient;
        _httpContextAccessor = httpContextAccessor;
        _tokenService = tokenService;
        _currentUserService = currentUserService;
        _logger = logger;
        
        var baseUrl = configuration["AiCoPilot:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = "http://localhost:8000"; // Fallback for local development
        }
        
        _httpClient.BaseAddress = new Uri(baseUrl);
        
        var timeoutStr = configuration["AiCoPilot:TimeoutSeconds"];
        var timeoutSeconds = int.TryParse(timeoutStr, out var sec) ? sec : 60;
        _httpClient.Timeout = TimeSpan.FromSeconds(timeoutSeconds);

        _serviceToken = configuration["AiCoPilot:ServiceToken"] ?? "default_service_token";
    }

    private void AttachAuthorization(HttpRequestMessage request)
    {
        // Generate a fresh short-lived JWT for each Backend->Backend call.
        // This avoids 401 "Token expired" caused by the ClockSkew gap between
        // .NET (tolerant) and Python FastAPI (strict). Both services share the same
        // JWT_SECRET/Issuer/Audience so Python validates this token identically.
        var userId = _currentUserService.UserId != Guid.Empty
            ? _currentUserService.UserId
            : Guid.NewGuid(); // Fallback for system-level calls

        var role = _httpContextAccessor.HttpContext?.User
                       ?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value
                   ?? _httpContextAccessor.HttpContext?.Request.Headers["X-Role"].FirstOrDefault()
                   ?? (_currentUserService.IsAuthenticated ? _currentUserService.Role.ToString() : "Admin");

        var companyId = _currentUserService.CompanyId != Guid.Empty ? _currentUserService.CompanyId : (Guid?)null;
        var departmentId = _currentUserService.DepartmentId != Guid.Empty ? _currentUserService.DepartmentId : (Guid?)null;

        var freshToken = _tokenService.GenerateServiceCallToken(userId, role, companyId, departmentId);
        request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {freshToken}");
        request.Headers.TryAddWithoutValidation("X-Role", role);
    }

    public async Task<GeneratedQuizDto?> GenerateQuizAsync(Guid lessonId)
    {
        var endpoint = $"/v1/admin/lessons/{lessonId}/generate-quiz";
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("[PythonAI] POST {Endpoint} | LessonId={LessonId}", endpoint, lessonId);

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            AttachAuthorization(request);

            var response = await _httpClient.SendAsync(request);
            sw.Stop();

            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("[PythonAI] FAIL POST {Endpoint} | LessonId={LessonId} StatusCode={StatusCode} ElapsedMs={ElapsedMs} Details={Details}",
                    endpoint, lessonId, (int)response.StatusCode, sw.ElapsedMilliseconds, errContent);
                return null;
            }

            _logger.LogInformation("[PythonAI] OK POST {Endpoint} | LessonId={LessonId} StatusCode={StatusCode} ElapsedMs={ElapsedMs}",
                endpoint, lessonId, (int)response.StatusCode, sw.ElapsedMilliseconds);

            return await response.Content.ReadFromJsonAsync<GeneratedQuizDto>();
        }
        catch (TaskCanceledException ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] TIMEOUT | Endpoint={Endpoint} LessonId={LessonId} ElapsedMs={ElapsedMs} (AI Engine did not respond within configured timeout)",
                endpoint, lessonId, sw.ElapsedMilliseconds);
            return null;
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] UNREACHABLE | Endpoint={Endpoint} LessonId={LessonId} ElapsedMs={ElapsedMs} (AI Engine server is offline or unreachable)",
                endpoint, lessonId, sw.ElapsedMilliseconds);
            return null;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] ERROR | Endpoint={Endpoint} LessonId={LessonId} ElapsedMs={ElapsedMs}",
                endpoint, lessonId, sw.ElapsedMilliseconds);
            return null;
        }
    }

    public async Task<GeneratedSummaryDto?> GenerateSummaryAsync(Guid lessonId)
    {
        var endpoint = $"/v1/admin/lessons/{lessonId}/generate-summary";
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("[PythonAI] POST {Endpoint} | LessonId={LessonId}", endpoint, lessonId);

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            AttachAuthorization(request);

            var response = await _httpClient.SendAsync(request);
            sw.Stop();

            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("[PythonAI] FAIL POST {Endpoint} | LessonId={LessonId} StatusCode={StatusCode} ElapsedMs={ElapsedMs} Details={Details}",
                    endpoint, lessonId, (int)response.StatusCode, sw.ElapsedMilliseconds, errContent);
                return null;
            }

            _logger.LogInformation("[PythonAI] OK POST {Endpoint} | LessonId={LessonId} StatusCode={StatusCode} ElapsedMs={ElapsedMs}",
                endpoint, lessonId, (int)response.StatusCode, sw.ElapsedMilliseconds);

            return await response.Content.ReadFromJsonAsync<GeneratedSummaryDto?>();
        }
        catch (TaskCanceledException ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] TIMEOUT | Endpoint={Endpoint} LessonId={LessonId} ElapsedMs={ElapsedMs}",
                endpoint, lessonId, sw.ElapsedMilliseconds);
            return null;
        }
        catch (HttpRequestException ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] UNREACHABLE | Endpoint={Endpoint} LessonId={LessonId} ElapsedMs={ElapsedMs}",
                endpoint, lessonId, sw.ElapsedMilliseconds);
            return null;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] ERROR | Endpoint={Endpoint} LessonId={LessonId} ElapsedMs={ElapsedMs}",
                endpoint, lessonId, sw.ElapsedMilliseconds);
            return null;
        }
    }

    public async Task<bool> ClearAiCacheAsync()
    {
        const string endpoint = "/v1/admin/cache/clear";
        var sw = Stopwatch.StartNew();
        _logger.LogInformation("[PythonAI] POST {Endpoint} | ClearAllCaches", endpoint);

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            AttachAuthorization(request);

            var response = await _httpClient.SendAsync(request);
            sw.Stop();

            if (!response.IsSuccessStatusCode)
            {
                var errContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("[PythonAI] FAIL POST {Endpoint} | StatusCode={StatusCode} ElapsedMs={ElapsedMs} Details={Details}",
                    endpoint, (int)response.StatusCode, sw.ElapsedMilliseconds, errContent);
                return false;
            }

            _logger.LogInformation("[PythonAI] OK POST {Endpoint} | StatusCode={StatusCode} ElapsedMs={ElapsedMs}",
                endpoint, (int)response.StatusCode, sw.ElapsedMilliseconds);

            return true;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "[PythonAI] ERROR | Endpoint={Endpoint}", endpoint);
            return false;
        }
    }
}
