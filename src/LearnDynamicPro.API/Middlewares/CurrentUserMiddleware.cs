using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Enums;
using System.Security.Claims;

namespace LearnDynamicPro.API.Middlewares;

public class CurrentUserMiddleware
{
    private readonly RequestDelegate _next;

    public CurrentUserMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ICurrentUserService currentUserService)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            // Note: Since ICurrentUserService is typically registered as Scoped or transient but acts as a data holder,
            // we need to set its values here. However, to inject values into it dynamically, it's better if it has setters, 
            // or if its implementation reads directly from HttpContext.User.
            
            // Wait, in Phase 4 we implemented ICurrentUserService using HttpContextAccessor.
            // Let's just ensure we don't conflict. The actual `CurrentUserService` in `Infrastructure` reads from `IHttpContextAccessor`.
            // So this middleware is technically not strictly required for extracting claims, 
            // but it is very useful for Logging Enrichment (like taking the UserId and pushing it to Serilog Context).
        }

        await _next(context);
    }
}
