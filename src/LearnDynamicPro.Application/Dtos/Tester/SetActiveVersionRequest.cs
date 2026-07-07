namespace LearnDynamicPro.Application.Dtos.Tester;

public class SetActiveVersionRequest
{
    public Guid ErpVersionId { get; set; }
}

public class CreateErpVersionRequest
{
    public string VersionLabel { get; set; } = string.Empty;
}

public class ErpVersionDto
{
    public Guid Id { get; set; }
    public string VersionLabel { get; set; } = string.Empty;
}
