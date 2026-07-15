using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class VersionTesterModule : BaseEntity
{
    public Guid VersionTesterId { get; set; }
    public Guid ModuleId { get; set; }

    public VersionTester? VersionTester { get; set; }
    public Module? Module { get; set; }
}
