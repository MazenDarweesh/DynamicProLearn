using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class LessonQuizConfiguration : IEntityTypeConfiguration<LessonQuiz>
{
    public void Configure(EntityTypeBuilder<LessonQuiz> builder)
    {
        builder.HasKey(q => q.Id);

        builder.HasQueryFilter(q => !q.IsDeleted);

        // ── Scalar Properties ─────────────────────────────────────────────
        builder.Property(q => q.GeneratedAt)
               .IsRequired();

        // ── JSON Column: Questions ─────────────────────────────────────────
        // EF Core 10 maps the entire List<QuizQuestion> into a single SQL
        // Server nvarchar(max) JSON column named "Questions".
        // The owned types (QuizQuestion, QuizOption) have no separate tables.
        builder.OwnsMany(q => q.Questions, questionBuilder =>
        {
            questionBuilder.ToJson();

            questionBuilder.Property(qq => qq.QuestionNumber).IsRequired();
            questionBuilder.Property(qq => qq.QuestionText).IsRequired();
            questionBuilder.Property(qq => qq.CorrectAnswerId).IsRequired();
            questionBuilder.Property(qq => qq.Explanation).IsRequired();

            // Nested owned collection: Options inside each Question
            questionBuilder.OwnsMany(qq => qq.Options, optionBuilder =>
            {
                optionBuilder.Property(o => o.OptionId).IsRequired();
                optionBuilder.Property(o => o.Text).IsRequired();
            });
        });

        // ── Performance Index ─────────────────────────────────────────────
        // Fast lookup: "Get the quiz for lesson X"
        builder.HasIndex(q => q.LessonId).IsUnique();

        // ── Relationships ─────────────────────────────────────────────────
        // One-to-one: Each Lesson has at most one active quiz row.
        // Deletion of a Lesson cascades to delete the quiz.
        builder.HasOne(q => q.Lesson)
               .WithOne(l => l.Quiz)
               .HasForeignKey<LessonQuiz>(q => q.LessonId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
