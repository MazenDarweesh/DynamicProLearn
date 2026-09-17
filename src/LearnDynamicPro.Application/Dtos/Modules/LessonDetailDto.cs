namespace LearnDynamicPro.Application.Dtos.Modules;

public class LessonDetailDto
{
    public Guid Id { get; set; }
    public Guid UnitId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string PdfUrl { get; set; } = string.Empty;
    public string ExternalLink { get; set; } = string.Empty;
    public string? ErpKey { get; set; }
    public Guid LevelId { get; set; }
    public string LevelLabel { get; set; } = string.Empty;
    public int LevelSortOrder { get; set; }
    public Guid TypeId { get; set; }
    public string TypeLabel { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public int LevelOrderIndex { get; set; }
    public bool IsCompleted { get; set; }
    public string AiStatus { get; set; } = "None";
    public string? AiError { get; set; }
    public int AiChunksCount { get; set; }
    public DateTime? AiProcessedAt { get; set; }
}
