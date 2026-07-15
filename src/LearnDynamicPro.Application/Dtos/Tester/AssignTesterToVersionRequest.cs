namespace LearnDynamicPro.Application.Dtos.Tester;

public class AssignTesterToVersionRequest
{
    public Guid TesterId { get; set; }
    public List<Guid> ModuleIds { get; set; } = new();
}
