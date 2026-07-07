using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class UnitConfiguration : IEntityTypeConfiguration<Unit>
{
    public void Configure(EntityTypeBuilder<Unit> builder)
    {
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Name)
               .IsRequired()
               .HasMaxLength(200);

        builder.HasOne(u => u.Module)
               .WithMany(m => m.Units)
               .HasForeignKey(u => u.ModuleId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(u => u.Lessons)
               .WithOne(l => l.Unit)
               .HasForeignKey(l => l.UnitId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
