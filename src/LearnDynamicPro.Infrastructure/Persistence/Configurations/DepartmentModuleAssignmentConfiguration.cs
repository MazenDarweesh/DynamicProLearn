using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class DepartmentModuleAssignmentConfiguration : IEntityTypeConfiguration<DepartmentModuleAssignment>
{
    public void Configure(EntityTypeBuilder<DepartmentModuleAssignment> builder)
    {
        builder.HasKey(a => a.Id);

        // ── Performance Index ──────────────────────────────────────────
        // Core query: "what modules+filters does this department have?"
        builder.HasIndex(a => new { a.DepartmentId, a.ModuleId, a.LevelId, a.TypeId });

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

        // LevelId & TypeId are nullable (NULL = no filter applied)
        builder.HasOne(a => a.Level)
               .WithMany(l => l.Assignments)
               .HasForeignKey(a => a.LevelId)
               .IsRequired(false)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(a => a.Type)
               .WithMany(t => t.Assignments)
               .HasForeignKey(a => a.TypeId)
               .IsRequired(false)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
