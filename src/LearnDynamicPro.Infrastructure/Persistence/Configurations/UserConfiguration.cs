using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);
        
        builder.HasQueryFilter(u => !u.IsDeleted);

        builder.Property(u => u.Username)
               .IsRequired()
               .HasMaxLength(100);

        builder.HasIndex(u => u.Username)
               .IsUnique();

        builder.Property(u => u.PasswordHash)
               .IsRequired();

        builder.Property(u => u.Role)
               .HasConversion<string>()
               .HasMaxLength(20);

        builder.HasOne(u => u.Company)
               .WithMany(c => c.Users)
               .HasForeignKey(u => u.CompanyId)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(u => u.Department)
               .WithMany(d => d.Users)
               .HasForeignKey(u => u.DepartmentId)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(u => u.ActiveVersion)
               .WithOne(av => av.User)
               .HasForeignKey<TesterActiveVersion>(av => av.UserId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
