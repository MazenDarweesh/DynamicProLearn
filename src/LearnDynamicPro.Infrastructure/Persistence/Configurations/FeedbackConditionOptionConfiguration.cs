using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class FeedbackConditionOptionConfiguration : IEntityTypeConfiguration<FeedbackConditionOption>
{
    public void Configure(EntityTypeBuilder<FeedbackConditionOption> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Label)
               .IsRequired()
               .HasMaxLength(200);

        builder.HasOne(f => f.CreatedByAdmin)
               .WithMany()
               .HasForeignKey(f => f.CreatedByAdminId)
               .OnDelete(DeleteBehavior.NoAction);

        builder.HasMany(f => f.Feedbacks)
               .WithOne(tf => tf.ConditionOption)
               .HasForeignKey(tf => tf.ConditionOptionId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
