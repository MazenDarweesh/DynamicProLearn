using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnDynamicPro.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonAiIngestionLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AiChunksCount",
                table: "Lessons",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "AiError",
                table: "Lessons",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiProcessedAt",
                table: "Lessons",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AiRetryCount",
                table: "Lessons",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AiStatus",
                table: "Lessons",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Lessons_AiStatus",
                table: "Lessons",
                column: "AiStatus");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Lessons_AiStatus",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "AiChunksCount",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "AiError",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "AiProcessedAt",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "AiRetryCount",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "AiStatus",
                table: "Lessons");
        }
    }
}
