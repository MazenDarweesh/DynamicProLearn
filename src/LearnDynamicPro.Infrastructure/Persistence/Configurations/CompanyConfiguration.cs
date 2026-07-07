using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class CompanyConfiguration : IEntityTypeConfiguration<Company>
{
    public void Configure(EntityTypeBuilder<Company> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
               .IsRequired()
               .HasMaxLength(200);

        builder.HasMany(c => c.Departments)
               .WithOne(d => d.Company)
               .HasForeignKey(d => d.CompanyId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Users)
               .WithOne(u => u.Company)
               .HasForeignKey(u => u.CompanyId)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
