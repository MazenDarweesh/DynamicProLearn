using LearnDynamicPro.Domain.Entities;
using LearnDynamicPro.Domain.Entities.AI;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class LessonSummaryConfiguration : IEntityTypeConfiguration<LessonSummary>
{
    public void Configure(EntityTypeBuilder<LessonSummary> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasQueryFilter(s => !s.IsDeleted);

        // ── Scalar Properties ─────────────────────────────────────────────
        builder.Property(s => s.GeneratedAt)
               .IsRequired();

        // Overview is a plain scalar text column (not JSON).
        // SQL Server nvarchar(max) to accommodate long AI-generated paragraphs.
        builder.Property(s => s.Overview)
               .HasColumnType("nvarchar(max)")
               .IsRequired();

        // ── JSON Column: Topics ───────────────────────────────────────────
        // EF Core 10 maps the entire List<SummaryTopic> into a single SQL
        // Server nvarchar(max) JSON column named "Topics".
        builder.OwnsMany(s => s.Topics, topicBuilder =>
        {
            topicBuilder.ToJson();

            topicBuilder.Property(t => t.TopicName).IsRequired();
            topicBuilder.Property(t => t.Explanation).IsRequired();

            // Nested primitive collection: KeyPoints is List<string>
            // EF Core 10 maps primitive collections inside JSON automatically.
            topicBuilder.PrimitiveCollection(t => t.KeyPoints);
        });

        // ── Performance Index ─────────────────────────────────────────────
        // Fast lookup: "Get the summary for lesson X"
        builder.HasIndex(s => s.LessonId).IsUnique();

        // ── Relationships ─────────────────────────────────────────────────
        // One-to-one: Each Lesson has at most one active summary row.
        builder.HasOne(s => s.Lesson)
               .WithOne(l => l.Summary)
               .HasForeignKey<LessonSummary>(s => s.LessonId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}
