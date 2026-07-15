namespace LearnDynamicPro.Application.Dtos.Tester;

public class VersionProgressDto
{
    public Guid VersionId { get; set; }
    public string VersionLabel { get; set; } = string.Empty;
    public List<TesterProgressInVersionDto> Testers { get; set; } = new();
}

public class TesterProgressInVersionDto
{
    public Guid TesterId { get; set; }
    public string TesterName { get; set; } = string.Empty;
    public List<ModuleProgressDto> Modules { get; set; } = new();
}

public class ModuleProgressDto
{
    public Guid ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    public List<LessonFeedbackDto> Lessons { get; set; } = new();
}

public class LessonFeedbackDto
{
    public Guid LessonId { get; set; }
    public string LessonTitle { get; set; } = string.Empty;
    public string? ConditionLabel { get; set; } // null = لم يُقيَّم بعد
    public string? Notes { get; set; }
    public DateTime? FeedbackDate { get; set; }
}
