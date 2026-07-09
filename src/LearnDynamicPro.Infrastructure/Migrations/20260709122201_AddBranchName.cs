using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnDynamicPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BranchName",
                table: "TesterActiveVersions",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BranchName",
                table: "TesterActiveVersions");
        }
    }
}
