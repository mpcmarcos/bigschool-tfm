using System.Net;
using Microsoft.EntityFrameworkCore;
using resources_api.Contracts;
using resources_api.Data;
using resources_api.Models;

namespace resources_api.Services
{
    public class ProjectService
    {
        private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
        {
            "viewer",
            "editor",
            "admin"
        };

        private readonly AppDbContext _dbContext;

        public ProjectService(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IReadOnlyList<ProjectResponse>> ListAccessibleProjectsAsync(Guid userId, CancellationToken cancellationToken)
        {
            var projects = await _dbContext.Projects
                .AsNoTracking()
                .Include(x => x.OwnerUser)
                .Where(x =>
                    !x.IsDeleted &&
                    (x.OwnerUserId == userId
                     || x.Members.Any(member => member.UserId == userId && !member.IsDeleted)))
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            return projects.Select(ToProjectResponse).ToArray();
        }

        public async Task<ProjectResponse> CreateProjectAsync(Guid userId, CreateProjectRequest request, CancellationToken cancellationToken)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
            if (user == null)
            {
                throw new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated.");
            }

            var now = DateTime.UtcNow;
            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = RequireName(request.Name),
                Description = NormalizeDescription(request.Description),
                OwnerUserId = userId,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _dbContext.Projects.Add(project);
            _dbContext.ProjectMembers.Add(new ProjectMember
            {
                Id = Guid.NewGuid(),
                ProjectId = project.Id,
                UserId = userId,
                Role = "admin",
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToProjectResponse(project, user.Email);
        }

        public async Task<ProjectResponse> UpdateProjectAsync(
            Guid userId,
            Guid projectId,
            UpdateProjectRequest request,
            CancellationToken cancellationToken)
        {
            var project = await GetProjectForAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            project.Name = RequireName(request.Name);
            project.Description = NormalizeDescription(request.Description);
            project.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);

            var ownerEmail = await _dbContext.Users
                .Where(x => x.Id == project.OwnerUserId)
                .Select(x => x.Email)
                .FirstAsync(cancellationToken);

            return ToProjectResponse(project, ownerEmail);
        }

        public async Task SoftDeleteProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
        {
            var project = await GetProjectForAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            project.IsDeleted = true;
            project.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<ProjectMemberResponse>> GetMembersAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
        {
            await GetProjectForAccessAsync(userId, projectId, requiresManagePermission: false, cancellationToken);

            var members = await _dbContext.ProjectMembers
                .AsNoTracking()
                .Include(x => x.User)
                .Where(x => x.ProjectId == projectId && !x.IsDeleted)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return members.Select(ToProjectMemberResponse).ToArray();
        }

        public async Task<ProjectMemberResponse> ShareProjectAsync(
            Guid userId,
            Guid projectId,
            ShareProjectMemberRequest request,
            CancellationToken cancellationToken)
        {
            await GetProjectForAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);

            var normalizedEmail = NormalizeEmail(request.Email);
            var role = NormalizeRole(request.Role);
            var targetUser = await _dbContext.Users.FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);

            if (targetUser == null)
            {
                targetUser = new User
                {
                    Id = Guid.NewGuid(),
                    Email = normalizedEmail,
                    CreatedAt = DateTime.UtcNow,
                    LastLoginAt = DateTime.UtcNow
                };
                _dbContext.Users.Add(targetUser);
            }

            var member = await _dbContext.ProjectMembers
                .Include(x => x.User)
                .FirstOrDefaultAsync(
                    x => x.ProjectId == projectId && x.UserId == targetUser.Id,
                    cancellationToken);

            if (member == null)
            {
                member = new ProjectMember
                {
                    Id = Guid.NewGuid(),
                    ProjectId = projectId,
                    UserId = targetUser.Id,
                    Role = role,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    IsDeleted = false
                };
                _dbContext.ProjectMembers.Add(member);
            }
            else
            {
                member.Role = role;
                member.IsDeleted = false;
                member.UpdatedAt = DateTime.UtcNow;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            if (member.User == null)
            {
                member.User = targetUser;
            }

            return ToProjectMemberResponse(member);
        }

        private async Task<Project> GetProjectForAccessAsync(
            Guid userId,
            Guid projectId,
            bool requiresManagePermission,
            CancellationToken cancellationToken)
        {
            var project = await _dbContext.Projects
                .Include(x => x.Members)
                .FirstOrDefaultAsync(x => x.Id == projectId && !x.IsDeleted, cancellationToken);

            if (project == null)
            {
                throw new ProjectException(HttpStatusCode.NotFound, "Project not found.");
            }

            if (project.OwnerUserId == userId)
            {
                return project;
            }

            var membership = project.Members.FirstOrDefault(x => x.UserId == userId && !x.IsDeleted);
            if (membership == null)
            {
                throw new ProjectException(HttpStatusCode.Forbidden, "You do not have access to this project.");
            }

            if (requiresManagePermission && !string.Equals(membership.Role, "admin", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(membership.Role, "editor", StringComparison.OrdinalIgnoreCase))
            {
                throw new ProjectException(HttpStatusCode.Forbidden, "You do not have permission to modify this project.");
            }

            return project;
        }

        private static string RequireName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new ProjectException(HttpStatusCode.BadRequest, "The name field is required.");
            }

            return name.Trim();
        }

        private static string NormalizeEmail(string? email)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                throw new ProjectException(HttpStatusCode.BadRequest, "The email field is required.");
            }

            return email.Trim().ToLowerInvariant();
        }

        private static string NormalizeRole(string? role)
        {
            var resolvedRole = string.IsNullOrWhiteSpace(role) ? "viewer" : role.Trim().ToLowerInvariant();
            if (!AllowedRoles.Contains(resolvedRole))
            {
                throw new ProjectException(HttpStatusCode.BadRequest, "Invalid project role.");
            }

            return resolvedRole;
        }

        private static string? NormalizeDescription(string? description)
        {
            if (string.IsNullOrWhiteSpace(description))
            {
                return null;
            }

            return description.Trim();
        }

        private static ProjectResponse ToProjectResponse(Project project)
        {
            return ToProjectResponse(project, project.OwnerUser.Email);
        }

        private static ProjectResponse ToProjectResponse(Project project, string ownerEmail)
        {
            return new ProjectResponse
            {
                Id = project.Id.ToString(),
                Name = project.Name,
                Description = project.Description,
                OwnerUserId = project.OwnerUserId.ToString(),
                OwnerEmail = ownerEmail,
                CreatedAt = project.CreatedAt,
                UpdatedAt = project.UpdatedAt,
                IsDeleted = project.IsDeleted
            };
        }

        private static ProjectMemberResponse ToProjectMemberResponse(ProjectMember member)
        {
            return new ProjectMemberResponse
            {
                Id = member.Id.ToString(),
                ProjectId = member.ProjectId.ToString(),
                UserId = member.UserId.ToString(),
                Email = member.User.Email,
                Role = member.Role,
                CreatedAt = member.CreatedAt,
                UpdatedAt = member.UpdatedAt,
                IsDeleted = member.IsDeleted
            };
        }
    }
}
