namespace LearnDynamicPro.Infrastructure.Identity;

public class ErpSsoSettings
{
    public const string SectionName = "ErpSso";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "ERPSystemAPI";
    public string Audience { get; set; } = "DynamicProLearn";
    public int MaxTokenLifetimeMinutes { get; set; } = 5;
    public bool AllowLegacyErpLogin { get; set; } = false;
}
