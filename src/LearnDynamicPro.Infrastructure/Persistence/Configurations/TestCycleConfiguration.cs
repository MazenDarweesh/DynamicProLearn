using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class TestCycleConfiguration : IEntityTypeConfiguration<TestCycle>
{
    public void Configure(EntityTypeBuilder<TestCycle> builder)
    {
        builder.HasQueryFilter(tc => !tc.IsDeleted);

        builder.HasKey(tc => tc.Id);

        builder.HasOne(tc => tc.Version)
               .WithMany(v => v.TestCycles)
               .HasForeignKey(tc => tc.VersionId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tc => tc.Tester)
               .WithMany(u => u.TestCycles)
               .HasForeignKey(tc => tc.TesterId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
