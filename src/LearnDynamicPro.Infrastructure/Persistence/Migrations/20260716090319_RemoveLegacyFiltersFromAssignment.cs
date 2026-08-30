using System;
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
            // Must drop Foreign Keys before dropping the columns they reference.
            // These FKs were added by the AddFeaturesUpgrade migration and are still
            // present when this migration runs on a fresh database.
            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentModuleAssignments_LevelOptions_LevelOptionId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentModuleAssignments_TypeOptions_TypeOptionId",
                table: "DepartmentModuleAssignments");

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

            migrationBuilder.AddForeignKey(
                name: "FK_DepartmentModuleAssignments_LevelOptions_LevelOptionId",
                table: "DepartmentModuleAssignments",
                column: "LevelOptionId",
                principalTable: "LevelOptions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DepartmentModuleAssignments_TypeOptions_TypeOptionId",
                table: "DepartmentModuleAssignments",
                column: "TypeOptionId",
                principalTable: "TypeOptions",
                principalColumn: "Id");
        }
    }
}
