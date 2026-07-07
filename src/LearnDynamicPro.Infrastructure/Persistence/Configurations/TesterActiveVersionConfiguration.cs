using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class TesterActiveVersionConfiguration : IEntityTypeConfiguration<TesterActiveVersion>
{
    public void Configure(EntityTypeBuilder<TesterActiveVersion> builder)
    {
        // PK = UserId (one active version per tester at a time — 1:1)
        builder.HasKey(tv => tv.UserId);

        builder.HasOne(tv => tv.User)
               .WithOne(u => u.ActiveVersion)
               .HasForeignKey<TesterActiveVersion>(tv => tv.UserId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tv => tv.ErpVersion)
               .WithMany(ev => ev.ActiveTesters)
               .HasForeignKey(tv => tv.ErpVersionId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}
