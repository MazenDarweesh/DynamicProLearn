using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class VersionTesterConfiguration : IEntityTypeConfiguration<VersionTester>
{
    public void Configure(EntityTypeBuilder<VersionTester> builder)
    {
        builder.HasQueryFilter(e => !e.IsDeleted);
        
        builder.HasMany(e => e.AssignedModules)
               .WithOne(e => e.VersionTester)
               .HasForeignKey(e => e.VersionTesterId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
