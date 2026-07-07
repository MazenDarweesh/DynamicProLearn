using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class FeedbackConditionOption : BaseEntity
{
    public string Label { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Guid CreatedByAdminId { get; set; }

    // Navigation
    public User? CreatedByAdmin { get; set; }
    public ICollection<TesterFeedback> Feedbacks { get; set; } = new List<TesterFeedback>();
}
