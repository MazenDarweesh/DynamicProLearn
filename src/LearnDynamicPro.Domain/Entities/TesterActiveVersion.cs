using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class TesterActiveVersion : ISoftDeletable
{
    public Guid UserId { get; set; }
    public Guid ErpVersionId { get; set; }
    public string? BranchName { get; set; }

    // Navigation
    public User? User { get; set; }
    public ErpVersion? ErpVersion { get; set; }
    
    public bool IsDeleted { get; set; } = false;
}
