using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class LevelOptionConfiguration : IEntityTypeConfiguration<LevelOption>
{
    public void Configure(EntityTypeBuilder<LevelOption> builder)
    {
        builder.HasKey(l => l.Id);
        
        builder.HasQueryFilter(l => !l.IsDeleted);

        builder.Property(l => l.Label)
               .IsRequired()
               .HasMaxLength(100);

        builder.HasOne(l => l.CreatedByAdmin)
               .WithMany()
               .HasForeignKey(l => l.CreatedByAdminId)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
