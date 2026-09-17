using System.Security.Claims;
using LearnDynamicPro.Domain.Entities;

namespace LearnDynamicPro.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(User user);
    string GenerateRefreshToken(User user);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
    bool ValidateRefreshToken(string refreshToken, out Guid userId);
    
    /// <summary>
    /// Generates a short-lived (5 min) JWT for internal Backend-to-Backend service calls.
    /// Python FastAPI validates this with the same JWT_SECRET/Issuer/Audience.
    /// </summary>
    string GenerateServiceCallToken(Guid userId, string role);
}
