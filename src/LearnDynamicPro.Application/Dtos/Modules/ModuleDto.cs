namespace LearnDynamicPro.Application.Dtos.Modules;

public class ModuleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<string> AssignedDepartments { get; set; } = new();
}
