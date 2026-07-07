using LearnDynamicPro.Domain.Common;

namespace LearnDynamicPro.Domain.Entities;

public class ErpVersion : BaseEntity
{
    public string VersionLabel { get; set; } = string.Empty;

    // Navigation
    public ICollection<TesterActiveVersion> ActiveTesters { get; set; } = new List<TesterActiveVersion>();
    public ICollection<TesterFeedback> Feedbacks { get; set; } = new List<TesterFeedback>();
}
