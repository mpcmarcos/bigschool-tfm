using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace resources_api.Data;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        var serverVersion = new MySqlServerVersion(new Version(8, 4, 0));
        optionsBuilder.UseMySql(
            "Server=localhost;Port=3306;Database=resourcesdb;User=resources_user;Password=resources_pass;",
            serverVersion);
        return new AppDbContext(optionsBuilder.Options);
    }
}
