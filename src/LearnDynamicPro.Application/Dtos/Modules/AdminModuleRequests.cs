namespace LearnDynamicPro.Application.Dtos.Modules;

public class CreateModuleRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class UpdateModuleRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

public class CreateUnitRequest
{
    public Guid ModuleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
}

public class UpdateUnitRequest
{
    public string Name { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
}

public class CreateLessonRequest
{
    public Guid UnitId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string PdfUrl { get; set; } = string.Empty;
    public string ExternalLink { get; set; } = string.Empty;
    public string? ErpKey { get; set; }
    public Guid LevelId { get; set; }
    public Guid TypeId { get; set; }
    public int OrderIndex { get; set; }
}

public class UpdateLessonRequest
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string VideoUrl { get; set; } = string.Empty;
    public string PdfUrl { get; set; } = string.Empty;
    public string ExternalLink { get; set; } = string.Empty;
    public string? ErpKey { get; set; }
    public Guid LevelId { get; set; }
    public Guid TypeId { get; set; }
    public int OrderIndex { get; set; }
}
