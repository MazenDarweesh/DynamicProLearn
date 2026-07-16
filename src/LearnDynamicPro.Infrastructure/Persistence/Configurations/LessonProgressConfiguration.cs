using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class LessonProgressConfiguration : IEntityTypeConfiguration<LessonProgress>
{
    public void Configure(EntityTypeBuilder<LessonProgress> builder)
    {
        // Composite PK — also acts as a unique index (no duplicate progress rows)
        builder.HasKey(lp => new { lp.UserId, lp.LessonId });

        builder.Property(lp => lp.CompletionSource)
               .HasConversion<string>()
               .HasMaxLength(20);

        builder.Property(lp => lp.CompletedAt)
               .IsRequired(false);

        // Global Query Filter
        builder.HasQueryFilter(lp => !lp.IsDeleted);

        // ── Relationships ─────────────────────────────────────────────
        builder.HasOne(lp => lp.User)
               .WithMany(u => u.CompletedProgresses)
               .HasForeignKey(lp => lp.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(lp => lp.Lesson)
               .WithMany(l => l.Progresses)
               .HasForeignKey(lp => lp.LessonId)
               .OnDelete(DeleteBehavior.Cascade);

        // Admin override: who marked this progress manually?
        builder.HasOne(lp => lp.MarkedByUser)
               .WithMany(u => u.MarkedProgresses)
               .HasForeignKey(lp => lp.MarkedByUserId)
               .IsRequired(false)
               .OnDelete(DeleteBehavior.NoAction);
    }
}
