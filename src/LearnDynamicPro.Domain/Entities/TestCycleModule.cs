namespace LearnDynamicPro.Domain.Entities;

public class TestCycleModule
{
    public Guid TestCycleId { get; set; }
    public TestCycle? TestCycle { get; set; }
    
    public Guid ModuleId { get; set; }
    public Module? Module { get; set; }
}
