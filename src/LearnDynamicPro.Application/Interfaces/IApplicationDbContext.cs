using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using DomainModule = LearnDynamicPro.Domain.Entities.Module;

namespace LearnDynamicPro.Application.Interfaces;

public interface IApplicationDbContext
{
    DbSet<LevelOption> LevelOptions { get; }
    DbSet<TypeOption> TypeOptions { get; }
    DbSet<FeedbackConditionOption> FeedbackConditionOptions { get; }
    DbSet<DomainModule> Modules { get; }
    DbSet<Unit> Units { get; }
    DbSet<Lesson> Lessons { get; }
    DbSet<Company> Companies { get; }
    DbSet<Department> Departments { get; }
    DbSet<User> Users { get; }
    DbSet<DepartmentModuleAssignment> DepartmentModuleAssignments { get; }
    DbSet<LessonProgress> LessonProgresses { get; }
    DbSet<ErpVersion> ErpVersions { get; }
    DbSet<TesterActiveVersion> TesterActiveVersions { get; }
    DbSet<VersionTester> VersionTesters { get; }
    DbSet<VersionTesterModule> VersionTesterModules { get; }
    DbSet<TesterFeedback> TesterFeedbacks { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
