using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class ErpVersionConfiguration : IEntityTypeConfiguration<ErpVersion>
{
    public void Configure(EntityTypeBuilder<ErpVersion> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.VersionLabel)
               .IsRequired()
               .HasMaxLength(50);

        builder.HasIndex(e => e.VersionLabel)
               .IsUnique();
    }
}
