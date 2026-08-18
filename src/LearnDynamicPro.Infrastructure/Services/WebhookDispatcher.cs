using LearnDynamicPro.Application.Interfaces;
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace LearnDynamicPro.Infrastructure.Services;

public class WebhookDispatcher : IWebhookDispatcher
{
    private readonly HttpClient _httpClient;
    private readonly string _webhookUrl;
    private readonly string _serviceToken;
    private readonly ILogger<WebhookDispatcher> _logger;

    public WebhookDispatcher(HttpClient httpClient, IConfiguration configuration, ILogger<WebhookDispatcher> logger)
    {
        _httpClient = httpClient;
        _webhookUrl = configuration["AiCoPilot:WebhookUrl"] ?? "http://localhost:8000/v1/webhooks/lesson-updated";
        _serviceToken = configuration["AiCoPilot:ServiceToken"] ?? "default_service_token";
        _logger = logger;
    }

    public async Task DispatchLessonUpdatedAsync(Guid lessonId)
    {
        await SendWebhookAsync(lessonId, "Updated");
    }

    public async Task DispatchLessonDeletedAsync(Guid lessonId)
    {
        await SendWebhookAsync(lessonId, "Deleted");
    }

    private async Task SendWebhookAsync(Guid lessonId, string action)
    {
        var payload = new
        {
            lessonId = lessonId.ToString(),
            action = action
        };

        var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        
        var request = new HttpRequestMessage(HttpMethod.Post, _webhookUrl)
        {
            Content = content
        };
        request.Headers.Add("X-Service-Token", _serviceToken);

        int maxRetries = 3;
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Webhook sent successfully for lesson {LessonId} with action {Action}", lessonId, action);
                    return;
                }
                _logger.LogWarning("Webhook failed for lesson {LessonId}. Status Code: {StatusCode}. Retry {RetryCount}/{MaxRetries}", lessonId, response.StatusCode, i + 1, maxRetries);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Exception while sending webhook for lesson {LessonId}. Retry {RetryCount}/{MaxRetries}", lessonId, i + 1, maxRetries);
            }

            if (i < maxRetries - 1)
            {
                await Task.Delay(TimeSpan.FromSeconds(2 * (i + 1)));
                
                // Clone the request because HttpRequestMessage cannot be reused
                var newRequest = new HttpRequestMessage(HttpMethod.Post, _webhookUrl)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                newRequest.Headers.Add("X-Service-Token", _serviceToken);
                request = newRequest;
            }
        }
        
        _logger.LogError("Webhook ultimately failed after {MaxRetries} retries for lesson {LessonId}", maxRetries, lessonId);
    }
}
