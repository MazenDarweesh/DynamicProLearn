using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnDynamicPro.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixShadowProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The columns and constraints were already dropped in a previous migration,
            // but lingering navigation properties in the code caused EF Core to think they
            // were still there. Now they are removed from the code, and this empty migration
            // just aligns the snapshot.
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
