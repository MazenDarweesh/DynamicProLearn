using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class Company : BaseEntity
{
    public string Name { get; set; } = string.Empty;

    // Navigation
    public ICollection<Department> Departments { get; set; } = new List<Department>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
