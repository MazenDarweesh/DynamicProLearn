using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class LessonConfiguration : IEntityTypeConfiguration<Lesson>
{
    public void Configure(EntityTypeBuilder<Lesson> builder)
    {
        builder.HasKey(l => l.Id);
        
        builder.HasQueryFilter(l => !l.IsDeleted);

        builder.Property(l => l.Title)
               .IsRequired()
               .HasMaxLength(300);

        builder.Property(l => l.VideoUrl)
               .IsRequired()
               .HasMaxLength(2000);

        // ── Performance Indexes ──────────────────────────────────────
        // Used for filtering lessons by Unit + Level + Type + order
        builder.HasIndex(l => new { l.UnitId, l.LevelId, l.TypeId, l.OrderIndex });

        // ── Relationships ─────────────────────────────────────────────
        builder.HasOne(l => l.Unit)
               .WithMany(u => u.Lessons)
               .HasForeignKey(l => l.UnitId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Level)
               .WithMany(lo => lo.Lessons)
               .HasForeignKey(l => l.LevelId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(l => l.Type)
               .WithMany(to => to.Lessons)
               .HasForeignKey(l => l.TypeId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
