namespace LearnDynamicPro.Application.Dtos.Modules;

public class LessonDto
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public Guid LevelId { get; set; }
    public string LevelLabel { get; set; } = string.Empty;
    public Guid TypeId { get; set; }
    public string TypeLabel { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string PdfUrl { get; set; } = string.Empty;
    public string ExternalLink { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public bool IsCompleted { get; set; }
}
