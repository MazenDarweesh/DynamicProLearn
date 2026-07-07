namespace LearnDynamicPro.Application.Dtos.Modules;

public class UnitDto
{
    public Guid Id { get; set; }
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
}
