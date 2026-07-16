using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class TestCycleModule : ISoftDeletable
{
    public Guid TestCycleId { get; set; }
    public TestCycle? TestCycle { get; set; }
    
    public Guid ModuleId { get; set; }
    public Module? Module { get; set; }
    
    public bool IsDeleted { get; set; } = false;
}
