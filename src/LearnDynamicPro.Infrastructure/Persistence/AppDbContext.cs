using LearnDynamicPro.Application.Interfaces;
using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Common;
using Microsoft.EntityFrameworkCore;
using DomainModule = LearnDynamicPro.Domain.Entities.Module;

namespace LearnDynamicPro.Infrastructure.Persistence;

public class AppDbContext : DbContext, IApplicationDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) 
    { 
    }

    // ── Lookup Tables ─────────────────────────────────────────────────
    public DbSet<LevelOption> LevelOptions => Set<LevelOption>();
    public DbSet<TypeOption> TypeOptions => Set<TypeOption>();
    public DbSet<FeedbackConditionOption> FeedbackConditionOptions => Set<FeedbackConditionOption>();

    // ── Content Hierarchy ─────────────────────────────────────────────
    public DbSet<DomainModule> Modules => Set<DomainModule>();
    public DbSet<Unit> Units => Set<Unit>();
    public DbSet<Lesson> Lessons => Set<Lesson>();

    // ── Org Hierarchy ─────────────────────────────────────────────────
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<User> Users => Set<User>();

    // ── Bridge & Assignment ───────────────────────────────────────────
    public DbSet<DepartmentModuleAssignment> DepartmentModuleAssignments => Set<DepartmentModuleAssignment>();
    public DbSet<AssignmentLevelFilter> AssignmentLevelFilters => Set<AssignmentLevelFilter>();
    public DbSet<AssignmentTypeFilter> AssignmentTypeFilters => Set<AssignmentTypeFilter>();

    // ── Progress ──────────────────────────────────────────────────────
    public DbSet<LessonProgress> LessonProgresses => Set<LessonProgress>();

    // ── AI Generated Content ──────────────────────────────────────────
    public DbSet<LessonQuiz> LessonQuizzes => Set<LessonQuiz>();
    public DbSet<LessonSummary> LessonSummaries => Set<LessonSummary>();

    // ── Tester ────────────────────────────────────────────────────────
    public DbSet<ErpVersion> ErpVersions => Set<ErpVersion>();
    public DbSet<TesterActiveVersion> TesterActiveVersions => Set<TesterActiveVersion>();
    public DbSet<VersionTester> VersionTesters => Set<VersionTester>();
    public DbSet<VersionTesterModule> VersionTesterModules => Set<VersionTesterModule>();
    public DbSet<TesterFeedback> TesterFeedbacks => Set<TesterFeedback>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Automatically picks up all IEntityTypeConfiguration<T> classes in this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        
        base.OnModelCreating(modelBuilder);
    }
}
