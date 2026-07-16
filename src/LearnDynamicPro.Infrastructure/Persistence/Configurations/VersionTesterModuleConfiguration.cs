using LearnDynamicPro.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace LearnDynamicPro.Infrastructure.Persistence.Configurations;

public class VersionTesterModuleConfiguration : IEntityTypeConfiguration<VersionTesterModule>
{
    public void Configure(EntityTypeBuilder<VersionTesterModule> builder)
    {
        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
