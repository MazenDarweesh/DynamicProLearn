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
    private readonly ILogger<PythonAiClient> _logger;

    public PythonAiClient(
        HttpClient httpClient,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ILogger<PythonAiClient> logger)
    {
        _httpClient = httpClient;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
        
        var baseUrl = configuration["AiCoPilot:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = "http://localhost:8000"; // Fallback for local development
        }
        
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromMinutes(5); // Explicit timeout since AI generation takes time

        _serviceToken = configuration["AiCoPilot:ServiceToken"] ?? "default_service_token";
    }

    private void AttachAuthorization(HttpRequestMessage request)
    {
        var authHeader = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(authHeader))
        {
            request.Headers.TryAddWithoutValidation("Authorization", authHeader);
        }
        else
        {
            request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_serviceToken}");
        }
    }

    public async Task<GeneratedQuizDto?> GenerateQuizAsync(Guid lessonId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/v1/admin/lessons/{lessonId}/generate-quiz");
        AttachAuthorization(request);

        var response = await _httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync();
            _logger.LogError("Failed to generate quiz for lesson {LessonId}. Status: {StatusCode}, Details: {Details}",
                lessonId, response.StatusCode, errContent);
            return null;
        }

        return await response.Content.ReadFromJsonAsync<GeneratedQuizDto>();
    }

    public async Task<GeneratedSummaryDto?> GenerateSummaryAsync(Guid lessonId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/v1/admin/lessons/{lessonId}/generate-summary");
        AttachAuthorization(request);

        var response = await _httpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var errContent = await response.Content.ReadAsStringAsync();
            _logger.LogError("Failed to generate summary for lesson {LessonId}. Status: {StatusCode}, Details: {Details}",
                lessonId, response.StatusCode, errContent);
            return null;
        }

        return await response.Content.ReadFromJsonAsync<GeneratedSummaryDto>();
    }
}
