namespace LearnDynamicPro.Application.Dtos.Tester;

public class VersionTesterDto
{
    public Guid Id { get; set; }
    public Guid VersionId { get; set; }
    public Guid TesterId { get; set; }
    public string TesterName { get; set; } = string.Empty;
    public int AssignedModulesCount { get; set; }
    public List<Guid> ModuleIds { get; set; } = new List<Guid>();
}
