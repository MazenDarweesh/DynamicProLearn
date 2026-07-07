using LearnDynamicPro.Domain.Entities;

namespace LearnDynamicPro.Application.Interfaces;

public interface ITokenService
{
    string GenerateToken(User user);
}
