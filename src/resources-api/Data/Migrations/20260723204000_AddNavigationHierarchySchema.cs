using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace resources_api.Data.Migrations
{
    public partial class AddNavigationHierarchySchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Pages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProjectId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pages_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Resources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ProjectId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NormalizedName = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Description = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Resources", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Resources_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "PageVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PageId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsDefault = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PageVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PageVersions_Pages_PageId",
                        column: x => x.PageId,
                        principalTable: "Pages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ResourceVersions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ResourceId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    Name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Value = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    IsDefault = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResourceVersions_Resources_ResourceId",
                        column: x => x.ResourceId,
                        principalTable: "Resources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ResourcePages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    PageVersionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    ResourceVersionId = table.Column<Guid>(type: "char(36)", nullable: false, collation: "ascii_general_ci"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    IsDeleted = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourcePages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ResourcePages_PageVersions_PageVersionId",
                        column: x => x.PageVersionId,
                        principalTable: "PageVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ResourcePages_ResourceVersions_ResourceVersionId",
                        column: x => x.ResourceVersionId,
                        principalTable: "ResourceVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_PageVersions_PageId_IsDeleted",
                table: "PageVersions",
                columns: new[] { "PageId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_PageVersions_PageId_IsDefault",
                table: "PageVersions",
                columns: new[] { "PageId", "IsDefault" },
                unique: true,
                filter: "\"IsDefault\" = 1 AND \"IsDeleted\" = 0");

            migrationBuilder.CreateIndex(
                name: "IX_Pages_ProjectId_IsDeleted",
                table: "Pages",
                columns: new[] { "ProjectId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourcePages_PageVersionId_IsDeleted",
                table: "ResourcePages",
                columns: new[] { "PageVersionId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourcePages_PageVersionId_ResourceVersionId",
                table: "ResourcePages",
                columns: new[] { "PageVersionId", "ResourceVersionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ResourcePages_ResourceVersionId_IsDeleted",
                table: "ResourcePages",
                columns: new[] { "ResourceVersionId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Resources_ProjectId_IsDeleted",
                table: "Resources",
                columns: new[] { "ProjectId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Resources_ProjectId_NormalizedName",
                table: "Resources",
                columns: new[] { "ProjectId", "NormalizedName" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceVersions_ResourceId_IsDeleted",
                table: "ResourceVersions",
                columns: new[] { "ResourceId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceVersions_ResourceId_IsDefault",
                table: "ResourceVersions",
                columns: new[] { "ResourceId", "IsDefault" },
                unique: true,
                filter: "\"IsDefault\" = 1 AND \"IsDeleted\" = 0");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ResourcePages");

            migrationBuilder.DropTable(
                name: "PageVersions");

            migrationBuilder.DropTable(
                name: "ResourceVersions");

            migrationBuilder.DropTable(
                name: "Pages");

            migrationBuilder.DropTable(
                name: "Resources");
        }
    }
}
