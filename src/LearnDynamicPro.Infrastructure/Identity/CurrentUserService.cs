using System.Security.Claims;
using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace LearnDynamicPro.Infrastructure.Identity;

public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public Guid UserId =>
        Guid.TryParse(
            User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User?.FindFirst("sub")?.Value,
            out var id) ? id : Guid.Empty;

    public string Username =>
        User?.FindFirst(ClaimTypes.Name)?.Value ?? string.Empty;

    public UserRole Role =>
        Enum.TryParse<UserRole>(User?.FindFirst(ClaimTypes.Role)?.Value, out var role)
            ? role : UserRole.Student;

    public Guid CompanyId =>
        Guid.TryParse(
            User?.FindFirst("company_id")?.Value
            ?? User?.FindFirst("companyId")?.Value
            ?? User?.FindFirst("CompanyId")?.Value,
            out var id) ? id : Guid.Empty;

    public Guid DepartmentId =>
        Guid.TryParse(
            User?.FindFirst("department_id")?.Value
            ?? User?.FindFirst("departmentId")?.Value
            ?? User?.FindFirst("DepartmentId")?.Value,
            out var id) ? id : Guid.Empty;
}
