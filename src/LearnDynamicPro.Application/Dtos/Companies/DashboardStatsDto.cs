namespace LearnDynamicPro.Application.Dtos.Companies;

public class DashboardStatsDto
{
    public int TotalCompanies { get; set; }
    public int ActiveUsers { get; set; }
    public int ActiveTesters { get; set; }
    public int PublishedModules { get; set; }
    public double AverageProgress { get; set; } // Percentage (e.g., 63.5)
}
