using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class TypeOptionConfiguration : IEntityTypeConfiguration<TypeOption>
{
    public void Configure(EntityTypeBuilder<TypeOption> builder)
    {
        builder.HasKey(t => t.Id);
        
        builder.HasQueryFilter(t => !t.IsDeleted);

        builder.Property(t => t.Label)
               .IsRequired()
               .HasMaxLength(100);

        builder.HasOne(t => t.CreatedByAdmin)
               .WithMany()
               .HasForeignKey(t => t.CreatedByAdminId)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
