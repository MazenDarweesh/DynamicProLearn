using System.Net.Http.Json;
using LearnDynamicPro.Application.Dtos.Internal;
using LearnDynamicPro.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace LearnDynamicPro.Infrastructure.Services;

public class PythonAiClient : IPythonAiClient
{
    private readonly HttpClient _httpClient;
    private readonly string _serviceToken;

    public PythonAiClient(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
        
        var baseUrl = configuration["AiCoPilot:BaseUrl"];
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = "http://localhost:8000"; // Fallback for local development
        }
        
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromMinutes(5); // Explicit timeout since AI generation takes time

        _serviceToken = configuration["AiCoPilot:ServiceToken"] ?? "default_service_token";
    }

    public async Task<GeneratedQuizDto?> GenerateQuizAsync(Guid lessonId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/v1/admin/lessons/{lessonId}/generate-quiz");
        request.Headers.Add("Authorization", $"Bearer {_serviceToken}");

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<GeneratedQuizDto>();
    }

    public async Task<GeneratedSummaryDto?> GenerateSummaryAsync(Guid lessonId)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, $"/v1/admin/lessons/{lessonId}/generate-summary");
        request.Headers.Add("Authorization", $"Bearer {_serviceToken}");

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<GeneratedSummaryDto>();
    }
}
