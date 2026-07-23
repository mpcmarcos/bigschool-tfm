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

            modelBuilder.Entity<Page>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
                entity.Property(x => x.Description).HasMaxLength(2000);
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.ProjectId, x.IsDeleted });
                entity.HasOne(x => x.Project)
                    .WithMany(x => x.Pages)
                    .HasForeignKey(x => x.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<PageVersion>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.PageId, x.IsDeleted });
                entity.HasIndex(x => new { x.PageId, x.IsDefault })
                    .HasFilter("\"IsDefault\" = 1 AND \"IsDeleted\" = 0")
                    .IsUnique();
                entity.HasOne(x => x.Page)
                    .WithMany(x => x.Versions)
                    .HasForeignKey(x => x.PageId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Resource>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
                entity.Property(x => x.NormalizedName).HasMaxLength(200);
                entity.Property(x => x.Description).HasMaxLength(2000);
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.ProjectId, x.IsDeleted });
                entity.HasIndex(x => new { x.ProjectId, x.NormalizedName });
                entity.HasOne(x => x.Project)
                    .WithMany(x => x.Resources)
                    .HasForeignKey(x => x.ProjectId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ResourceVersion>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
                entity.Property(x => x.Value).IsRequired();
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.ResourceId, x.IsDeleted });
                entity.HasIndex(x => new { x.ResourceId, x.IsDefault })
                    .HasFilter("\"IsDefault\" = 1 AND \"IsDeleted\" = 0")
                    .IsUnique();
                entity.HasOne(x => x.Resource)
                    .WithMany(x => x.Versions)
                    .HasForeignKey(x => x.ResourceId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<ResourcePage>(entity =>
            {
                entity.HasKey(x => x.Id);
                entity.Property(x => x.CreatedAt).IsRequired();
                entity.Property(x => x.UpdatedAt).IsRequired();
                entity.Property(x => x.IsDeleted).IsRequired();
                entity.HasIndex(x => new { x.PageVersionId, x.ResourceVersionId }).IsUnique();
                entity.HasIndex(x => new { x.PageVersionId, x.IsDeleted });
                entity.HasIndex(x => new { x.ResourceVersionId, x.IsDeleted });
                entity.HasOne(x => x.PageVersion)
                    .WithMany(x => x.ResourcePages)
                    .HasForeignKey(x => x.PageVersionId)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(x => x.ResourceVersion)
                    .WithMany(x => x.ResourcePages)
                    .HasForeignKey(x => x.ResourceVersionId)
                    .OnDelete(DeleteBehavior.Cascade);
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
