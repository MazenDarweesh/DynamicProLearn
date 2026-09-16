using System.Security.Claims;
using LearnDynamicPro.Domain.Entities;

namespace LearnDynamicPro.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(User user);
    string GenerateRefreshToken(User user);
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
    bool ValidateRefreshToken(string refreshToken, out Guid userId);
}
