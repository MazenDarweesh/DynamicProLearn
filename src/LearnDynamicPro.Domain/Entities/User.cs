using LearnDynamicPro.Domain.Common;
using LearnDynamicPro.Domain.Enums;

namespace LearnDynamicPro.Domain.Entities;

public class User : BaseEntity
{
    public Guid CompanyId { get; set; }
    public Guid DepartmentId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }

    // Navigation
    public Company? Company { get; set; }
    public Department? Department { get; set; }
    public TesterActiveVersion? ActiveVersion { get; set; }
    public ICollection<LessonProgress> CompletedProgresses { get; set; } = new List<LessonProgress>();
    public ICollection<LessonProgress> MarkedProgresses { get; set; } = new List<LessonProgress>();
    public ICollection<TesterFeedback> Feedbacks { get; set; } = new List<TesterFeedback>();
}
