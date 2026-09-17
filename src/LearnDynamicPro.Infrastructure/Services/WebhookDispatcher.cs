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
        var url = configuration["AiCoPilot:WebhookUrl"];
        _webhookUrl = !string.IsNullOrWhiteSpace(url) ? url : "http://localhost:8000/v1/webhooks/lesson-updated";
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
            lesson_id = lessonId.ToString(),
            lessonId  = lessonId.ToString(),
            action    = action
        };

        _logger.LogInformation("[WebhookDispatcher] START | TargetUrl={Url} LessonId={LessonId} Action={Action}",
            _webhookUrl, lessonId, action);

        int maxRetries = 3;
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
                var request = new HttpRequestMessage(HttpMethod.Post, _webhookUrl)
                {
                    Content = content
                };
                request.Headers.Add("X-Service-Token", _serviceToken);
                request.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_serviceToken}");

                var response = await _httpClient.SendAsync(request);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("[WebhookDispatcher] OK | LessonId={LessonId} Action={Action} StatusCode={StatusCode}",
                        lessonId, action, (int)response.StatusCode);
                    return;
                }
                var errBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("[WebhookDispatcher] FAIL | LessonId={LessonId} StatusCode={StatusCode} Retry={Retry}/{Max} Details={Details}",
                    lessonId, (int)response.StatusCode, i + 1, maxRetries, errBody);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[WebhookDispatcher] EXCEPTION | LessonId={LessonId} Retry={Retry}/{Max}",
                    lessonId, i + 1, maxRetries);
            }

            if (i < maxRetries - 1)
            {
                await Task.Delay(TimeSpan.FromSeconds(2 * (i + 1)));
            }
        }
        
        _logger.LogError("[WebhookDispatcher] ULTIMATELY_FAILED | Retries={Max} LessonId={LessonId}", maxRetries, lessonId);
    }
}
