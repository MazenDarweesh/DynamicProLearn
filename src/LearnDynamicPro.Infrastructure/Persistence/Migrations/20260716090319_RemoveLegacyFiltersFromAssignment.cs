using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnDynamicPro.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLegacyFiltersFromAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DepartmentModuleAssignments_LevelOptionId",
                table: "DepartmentModuleAssignments");
                
            migrationBuilder.DropIndex(
                name: "IX_DepartmentModuleAssignments_TypeOptionId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropColumn(
                name: "LevelOptionId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropColumn(
                name: "TypeOptionId",
                table: "DepartmentModuleAssignments");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LevelOptionId",
                table: "DepartmentModuleAssignments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TypeOptionId",
                table: "DepartmentModuleAssignments",
                type: "uniqueidentifier",
                nullable: true);
                
            migrationBuilder.CreateIndex(
                name: "IX_DepartmentModuleAssignments_LevelOptionId",
                table: "DepartmentModuleAssignments",
                column: "LevelOptionId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentModuleAssignments_TypeOptionId",
                table: "DepartmentModuleAssignments",
                column: "TypeOptionId");
        }
    }
}
