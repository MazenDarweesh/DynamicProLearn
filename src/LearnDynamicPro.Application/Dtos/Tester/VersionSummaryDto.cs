namespace LearnDynamicPro.Application.Dtos.Tester;

public class VersionSummaryDto
{
    public Guid VersionId { get; set; }
    public string VersionLabel { get; set; } = string.Empty;
    public int TestersCount { get; set; }
    public int TotalModulesAssigned { get; set; }
    public int TotalFeedbacks { get; set; }
}
