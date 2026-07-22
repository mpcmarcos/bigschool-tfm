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

        public DbSet<Project> Projects => Set<Project>();

        public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();

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

            modelBuilder.Entity<Project>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
                entity.Property(x => x.Description).HasMaxLength(2000);
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.OwnerUserId, x.IsDeleted });
                entity.HasOne(x => x.OwnerUser)
                    .WithMany(x => x.OwnedProjects)
                    .HasForeignKey(x => x.OwnerUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ProjectMember>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Role).IsRequired().HasMaxLength(20);
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique();
                entity.HasIndex(x => new { x.UserId, x.IsDeleted });
                entity.HasOne(x => x.Project)
                    .WithMany(x => x.Members)
                    .HasForeignKey(x => x.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(x => x.User)
                    .WithMany(x => x.ProjectMemberships)
                    .HasForeignKey(x => x.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
