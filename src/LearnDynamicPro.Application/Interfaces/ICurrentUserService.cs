using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Application.Interfaces;

/// <summary>
/// Provides contextual information about the currently authenticated user,
/// extracted from the JWT token by the CurrentUserMiddleware.
/// </summary>
public interface ICurrentUserService
{
    Guid UserId { get; }
    string Username { get; }
    UserRole Role { get; }
    Guid CompanyId { get; }
    Guid DepartmentId { get; }
    bool IsAuthenticated { get; }
}
