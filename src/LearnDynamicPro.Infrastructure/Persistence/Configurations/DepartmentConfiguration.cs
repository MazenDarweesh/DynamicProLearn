using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Name)
               .IsRequired()
               .HasMaxLength(200);

        builder.HasOne(d => d.Company)
               .WithMany(c => c.Departments)
               .HasForeignKey(d => d.CompanyId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(d => d.Users)
               .WithOne(u => u.Department)
               .HasForeignKey(u => u.DepartmentId)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasMany(d => d.Assignments)
               .WithOne(a => a.Department)
               .HasForeignKey(a => a.DepartmentId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
