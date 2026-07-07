using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class ModuleConfiguration : IEntityTypeConfiguration<Module>
{
    public void Configure(EntityTypeBuilder<Module> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Name)
               .IsRequired()
               .HasMaxLength(200);

        builder.Property(m => m.Description)
               .HasMaxLength(1000);

        builder.HasMany(m => m.Units)
               .WithOne(u => u.Module)
               .HasForeignKey(u => u.ModuleId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
