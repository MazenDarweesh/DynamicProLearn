using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LearnDynamicPro.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLevelOrderIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SQL Server auto-generates a named Default Constraint when a column is added with
            // defaultValue. EF Core does not track this constraint, so we must drop it manually
            // before dropping the column to avoid SQL Error 5074.
            migrationBuilder.Sql(@"
                DECLARE @constraintName NVARCHAR(200)
                SELECT @constraintName = dc.name
                FROM sys.default_constraints dc
                JOIN sys.columns c 
                    ON dc.parent_object_id = c.object_id 
                    AND dc.parent_column_id = c.column_id
                JOIN sys.tables t 
                    ON c.object_id = t.object_id
                WHERE t.name = 'Lessons' AND c.name = 'LevelOrderIndex'
                IF @constraintName IS NOT NULL
                    EXEC('ALTER TABLE [Lessons] DROP CONSTRAINT [' + @constraintName + ']')
            ");

            migrationBuilder.DropColumn(
                name: "LevelOrderIndex",
                table: "Lessons");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LevelOrderIndex",
                table: "Lessons",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
