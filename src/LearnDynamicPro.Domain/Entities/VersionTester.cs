using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class VersionTester : BaseEntity
{
    public Guid VersionId { get; set; }
    public Guid TesterId { get; set; }

    public ErpVersion? Version { get; set; }
    public User? Tester { get; set; }
    
    public ICollection<VersionTesterModule> AssignedModules { get; set; } = new List<VersionTesterModule>();
}
