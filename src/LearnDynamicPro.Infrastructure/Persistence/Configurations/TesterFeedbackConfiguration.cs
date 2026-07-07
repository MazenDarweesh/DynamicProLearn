using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class TesterFeedbackConfiguration : IEntityTypeConfiguration<TesterFeedback>
{
    public void Configure(EntityTypeBuilder<TesterFeedback> builder)
    {
        builder.HasKey(tf => tf.Id);

        builder.Property(tf => tf.Notes)
               .HasMaxLength(4000);

        // ── Performance Index ──────────────────────────────────────────
        // Common query: get all feedback by a tester for a specific version
        builder.HasIndex(tf => new { tf.UserId, tf.ErpVersionId });

        // ── Relationships ─────────────────────────────────────────────
        builder.HasOne(tf => tf.User)
               .WithMany(u => u.Feedbacks)
               .HasForeignKey(tf => tf.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tf => tf.Lesson)
               .WithMany(l => l.Feedbacks)
               .HasForeignKey(tf => tf.LessonId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tf => tf.ErpVersion)
               .WithMany(ev => ev.Feedbacks)
               .HasForeignKey(tf => tf.ErpVersionId)
               .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(tf => tf.ConditionOption)
               .WithMany(co => co.Feedbacks)
               .HasForeignKey(tf => tf.ConditionOptionId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
