using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class AssignmentTypeFilterConfiguration : IEntityTypeConfiguration<AssignmentTypeFilter>
{
    public void Configure(EntityTypeBuilder<AssignmentTypeFilter> builder)
    {
        builder.HasKey(a => a.Id);
        
        builder.HasQueryFilter(a => !a.IsDeleted);

        builder.HasOne(a => a.Assignment)
               .WithMany(m => m.TypeFilters)
               .HasForeignKey(a => a.AssignmentId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Type)
               .WithMany()
               .HasForeignKey(a => a.TypeId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
