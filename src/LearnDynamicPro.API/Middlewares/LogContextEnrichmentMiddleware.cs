using Serilog.Context;
using System.Security.Claims;

namespace LearnDynamicPro.API.Middlewares;

public class LogContextEnrichmentMiddleware
{
    private readonly RequestDelegate _next;

    public LogContextEnrichmentMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.TraceIdentifier;

        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var userId = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var companyId = context.User.FindFirst("CompanyId")?.Value;
                var departmentId = context.User.FindFirst("DepartmentId")?.Value;

                using (LogContext.PushProperty("UserId", userId))
                using (LogContext.PushProperty("CompanyId", companyId))
                using (LogContext.PushProperty("DepartmentId", departmentId))
                {
                    await _next(context);
                }
            }
            else
            {
                await _next(context);
            }
        }
    }
}
