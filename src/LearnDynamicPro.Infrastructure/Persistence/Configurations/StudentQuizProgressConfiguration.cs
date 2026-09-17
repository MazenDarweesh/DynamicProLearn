using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class StudentQuizProgressConfiguration : IEntityTypeConfiguration<StudentQuizProgress>
{
    public void Configure(EntityTypeBuilder<StudentQuizProgress> builder)
    {
        builder.HasKey(p => p.Id);

        builder.HasQueryFilter(p => !p.IsDeleted);

        builder.Property(p => p.UserId).IsRequired();
        builder.Property(p => p.LessonId).IsRequired();
        builder.Property(p => p.TotalQuestions).IsRequired();
        builder.Property(p => p.CorrectCount).IsRequired();
        builder.Property(p => p.ScorePercentage).IsRequired();
        builder.Property(p => p.IsCompleted).IsRequired();
        builder.Property(p => p.LastAccessedAt).IsRequired();

        // ── JSON Column: Answers ──────────────────────────────────────────
        builder.OwnsMany(p => p.Answers, answerBuilder =>
        {
            answerBuilder.ToJson();
            answerBuilder.Property(a => a.QuestionNumber).IsRequired();
            answerBuilder.Property(a => a.SelectedOptionId).IsRequired();
            answerBuilder.Property(a => a.IsCorrect).IsRequired();
            answerBuilder.Property(a => a.CorrectAnswerId).IsRequired();
            answerBuilder.Property(a => a.Explanation).IsRequired();
            answerBuilder.Property(a => a.AnsweredAt).IsRequired();
        });

        // ── Unique Index: One progress record per User + Lesson ─────────────
        builder.HasIndex(p => new { p.UserId, p.LessonId }).IsUnique();

        // ── Relationships ─────────────────────────────────────────────────
        builder.HasOne(p => p.User)
               .WithMany()
               .HasForeignKey(p => p.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Lesson)
               .WithMany()
               .HasForeignKey(p => p.LessonId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
