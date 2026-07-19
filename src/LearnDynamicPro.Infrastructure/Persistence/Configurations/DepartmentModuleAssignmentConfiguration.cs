using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class DepartmentModuleAssignmentConfiguration : IEntityTypeConfiguration<DepartmentModuleAssignment>
{
    public void Configure(EntityTypeBuilder<DepartmentModuleAssignment> builder)
    {
        builder.HasKey(a => a.Id);
        
        builder.HasQueryFilter(a => !a.IsDeleted);

        // ── Performance Index ──────────────────────────────────────────
        builder.HasIndex(a => new { a.DepartmentId, a.ModuleId });

        builder.Property(a => a.AssignedAt)
               .IsRequired();

        // ── Relationships ─────────────────────────────────────────────
        builder.HasOne(a => a.Department)
               .WithMany(d => d.Assignments)
               .HasForeignKey(a => a.DepartmentId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Module)
               .WithMany(m => m.Assignments)
               .HasForeignKey(a => a.ModuleId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
