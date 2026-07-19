using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class AssignmentLevelFilterConfiguration : IEntityTypeConfiguration<AssignmentLevelFilter>
{
    public void Configure(EntityTypeBuilder<AssignmentLevelFilter> builder)
    {
        builder.HasKey(a => a.Id);
        
        builder.HasQueryFilter(a => !a.IsDeleted);

        builder.HasOne(a => a.Assignment)
               .WithMany(m => m.LevelFilters)
               .HasForeignKey(a => a.AssignmentId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Level)
               .WithMany()
               .HasForeignKey(a => a.LevelId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
