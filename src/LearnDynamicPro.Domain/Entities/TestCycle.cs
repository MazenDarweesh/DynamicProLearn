using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class TestCycle : BaseEntity
{
    public Guid VersionId { get; set; }
    public ErpVersion? Version { get; set; }
    
    public Guid TesterId { get; set; }
    public User? Tester { get; set; }
    
    public ICollection<TestCycleModule> AssignedModules { get; set; } = new List<TestCycleModule>();
}
