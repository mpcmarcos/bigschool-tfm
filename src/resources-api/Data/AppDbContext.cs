using Microsoft.EntityFrameworkCore;
using resources_api.Models;

namespace resources_api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users => Set<User>();

        public DbSet<UserSocialLogin> UserSocialLogins => Set<UserSocialLogin>();

        public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Email).IsRequired();
                entity.HasIndex(x => x.Email).IsUnique();
                entity.Property(x => x.LastLoginAt).IsRequired();
                entity.Property(x => x.CreatedAt).IsRequired();
            });

            modelBuilder.Entity<UserSocialLogin>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Provider).IsRequired();
                entity.Property(x => x.ProviderUserId).IsRequired();
                entity.Property(x => x.ProviderEmail).IsRequired();
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.HasIndex(x => new { x.Provider, x.ProviderUserId }).IsUnique();
                entity.HasOne(x => x.User)
                    .WithMany(x => x.SocialLogins)
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RefreshToken>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.TokenHash).IsRequired();
                entity.Property(x => x.ExpiresAt).IsRequired();
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.HasIndex(x => x.TokenHash).IsUnique();
                entity.HasIndex(x => x.UserId);
                entity.HasOne(x => x.User)
                    .WithMany(x => x.RefreshTokens)
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
