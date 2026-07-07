using System.Security.Cryptography;
using System.Text;
using LearnDynamicPro.Application.Interfaces;

namespace LearnDynamicPro.Infrastructure.Identity;

public class PasswordHasher : IPasswordHasher
{
    public string Hash(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLower();
    }

    public bool Verify(string password, string hash)
    {
        return Hash(password) == hash;
    }
}
