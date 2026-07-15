using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnDynamicPro.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFeaturesUpgrade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentModuleAssignments_LevelOptions_LevelId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentModuleAssignments_TypeOptions_TypeId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropIndex(
                name: "IX_DepartmentModuleAssignments_DepartmentId_ModuleId_LevelId_TypeId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.RenameColumn(
                name: "TypeId",
                table: "DepartmentModuleAssignments",
                newName: "TypeOptionId");

            migrationBuilder.RenameColumn(
                name: "LevelId",
                table: "DepartmentModuleAssignments",
                newName: "LevelOptionId");

            migrationBuilder.RenameIndex(
                name: "IX_DepartmentModuleAssignments_TypeId",
                table: "DepartmentModuleAssignments",
                newName: "IX_DepartmentModuleAssignments_TypeOptionId");

            migrationBuilder.RenameIndex(
                name: "IX_DepartmentModuleAssignments_LevelId",
                table: "DepartmentModuleAssignments",
                newName: "IX_DepartmentModuleAssignments_LevelOptionId");

            migrationBuilder.AddColumn<int>(
                name: "LevelOrderIndex",
                table: "Lessons",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAccessedAt",
                table: "LessonProgresses",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateTable(
                name: "AssignmentLevelFilters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LevelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentLevelFilters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssignmentLevelFilters_DepartmentModuleAssignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "DepartmentModuleAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssignmentLevelFilters_LevelOptions_LevelId",
                        column: x => x.LevelId,
                        principalTable: "LevelOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AssignmentTypeFilters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TypeId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssignmentTypeFilters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssignmentTypeFilters_DepartmentModuleAssignments_AssignmentId",
                        column: x => x.AssignmentId,
                        principalTable: "DepartmentModuleAssignments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AssignmentTypeFilters_TypeOptions_TypeId",
                        column: x => x.TypeId,
                        principalTable: "TypeOptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VersionTesters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VersionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VersionTesters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VersionTesters_ErpVersions_VersionId",
                        column: x => x.VersionId,
                        principalTable: "ErpVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VersionTesters_Users_TesterId",
                        column: x => x.TesterId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VersionTesterModules",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    VersionTesterId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ModuleId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VersionTesterModules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VersionTesterModules_Modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "Modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VersionTesterModules_VersionTesters_VersionTesterId",
                        column: x => x.VersionTesterId,
                        principalTable: "VersionTesters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentModuleAssignments_DepartmentId_ModuleId",
                table: "DepartmentModuleAssignments",
                columns: new[] { "DepartmentId", "ModuleId" });

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentLevelFilters_AssignmentId",
                table: "AssignmentLevelFilters",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentLevelFilters_LevelId",
                table: "AssignmentLevelFilters",
                column: "LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentTypeFilters_AssignmentId",
                table: "AssignmentTypeFilters",
                column: "AssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_AssignmentTypeFilters_TypeId",
                table: "AssignmentTypeFilters",
                column: "TypeId");

            migrationBuilder.CreateIndex(
                name: "IX_VersionTesterModules_ModuleId",
                table: "VersionTesterModules",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_VersionTesterModules_VersionTesterId",
                table: "VersionTesterModules",
                column: "VersionTesterId");

            migrationBuilder.CreateIndex(
                name: "IX_VersionTesters_TesterId",
                table: "VersionTesters",
                column: "TesterId");

            migrationBuilder.CreateIndex(
                name: "IX_VersionTesters_VersionId",
                table: "VersionTesters",
                column: "VersionId");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentModuleAssignments_LevelOptions_LevelOptionId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_DepartmentModuleAssignments_TypeOptions_TypeOptionId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropTable(
                name: "AssignmentLevelFilters");

            migrationBuilder.DropTable(
                name: "AssignmentTypeFilters");

            migrationBuilder.DropTable(
                name: "VersionTesterModules");

            migrationBuilder.DropTable(
                name: "VersionTesters");

            migrationBuilder.DropIndex(
                name: "IX_DepartmentModuleAssignments_DepartmentId_ModuleId",
                table: "DepartmentModuleAssignments");

            migrationBuilder.DropColumn(
                name: "LevelOrderIndex",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "LastAccessedAt",
                table: "LessonProgresses");

            migrationBuilder.RenameColumn(
                name: "TypeOptionId",
                table: "DepartmentModuleAssignments",
                newName: "TypeId");

            migrationBuilder.RenameColumn(
                name: "LevelOptionId",
                table: "DepartmentModuleAssignments",
                newName: "LevelId");

            migrationBuilder.RenameIndex(
                name: "IX_DepartmentModuleAssignments_TypeOptionId",
                table: "DepartmentModuleAssignments",
                newName: "IX_DepartmentModuleAssignments_TypeId");

            migrationBuilder.RenameIndex(
                name: "IX_DepartmentModuleAssignments_LevelOptionId",
                table: "DepartmentModuleAssignments",
                newName: "IX_DepartmentModuleAssignments_LevelId");

            migrationBuilder.CreateIndex(
                name: "IX_DepartmentModuleAssignments_DepartmentId_ModuleId_LevelId_TypeId",
                table: "DepartmentModuleAssignments",
                columns: new[] { "DepartmentId", "ModuleId", "LevelId", "TypeId" });

            migrationBuilder.AddForeignKey(
                name: "FK_DepartmentModuleAssignments_LevelOptions_LevelId",
                table: "DepartmentModuleAssignments",
                column: "LevelId",
                principalTable: "LevelOptions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_DepartmentModuleAssignments_TypeOptions_TypeId",
                table: "DepartmentModuleAssignments",
                column: "TypeId",
                principalTable: "TypeOptions",
                principalColumn: "Id");
        }
    }
}
