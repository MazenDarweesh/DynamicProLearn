using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class TestCycleModuleConfiguration : IEntityTypeConfiguration<TestCycleModule>
{
    public void Configure(EntityTypeBuilder<TestCycleModule> builder)
    {
        builder.HasKey(tcm => new { tcm.TestCycleId, tcm.ModuleId });

        builder.HasOne(tcm => tcm.TestCycle)
               .WithMany(tc => tc.AssignedModules)
               .HasForeignKey(tcm => tcm.TestCycleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tcm => tcm.Module)
               .WithMany(m => m.TestCycleModules)
               .HasForeignKey(tcm => tcm.ModuleId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
