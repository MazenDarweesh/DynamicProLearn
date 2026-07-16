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

    // ── Tester ────────────────────────────────────────────────────────
    public DbSet<ErpVersion> ErpVersions => Set<ErpVersion>();
    public DbSet<TesterActiveVersion> TesterActiveVersions => Set<TesterActiveVersion>();
    public DbSet<TestCycle> TestCycles => Set<TestCycle>();
    public DbSet<TestCycleModule> TestCycleModules => Set<TestCycleModule>();
    public DbSet<VersionTester> VersionTesters => Set<VersionTester>();
    public DbSet<VersionTesterModule> VersionTesterModules => Set<VersionTesterModule>();
    public DbSet<TesterFeedback> TesterFeedbacks => Set<TesterFeedback>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Automatically picks up all IEntityTypeConfiguration<T> classes in this assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
        
        // Apply Global Query Filter for Soft Delete
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "e");
                var property = System.Linq.Expressions.Expression.Property(parameter, nameof(BaseEntity.IsDeleted));
                var condition = System.Linq.Expressions.Expression.Equal(property, System.Linq.Expressions.Expression.Constant(false));
                var lambda = System.Linq.Expressions.Expression.Lambda(condition, parameter);

                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
            }
        }

        base.OnModelCreating(modelBuilder);
    }
}
