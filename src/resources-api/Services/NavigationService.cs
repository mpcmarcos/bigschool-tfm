using System.Net;
using Microsoft.EntityFrameworkCore;
using resources_api.Contracts;
using resources_api.Data;
using resources_api.Models;

namespace resources_api.Services
{
    public class NavigationService
    {
        private readonly AppDbContext _dbContext;

        public NavigationService(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IReadOnlyList<PageResponse>> ListPagesAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: false, cancellationToken);

            var pages = await _dbContext.Pages
                .AsNoTracking()
                .Where(x => x.ProjectId == projectId && !x.IsDeleted)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            return pages.Select(ToPageResponse).ToArray();
        }

        public async Task<PageResponse> CreatePageAsync(
            Guid userId,
            Guid projectId,
            CreatePageRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);

            var now = DateTime.UtcNow;
            var page = new Page
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Name = RequireName(request.Name),
                Description = NormalizeDescription(request.Description),
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _dbContext.Pages.Add(page);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToPageResponse(page);
        }

        public async Task<PageResponse> UpdatePageAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            UpdatePageRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            var page = await RequirePageAsync(projectId, pageId, cancellationToken);

            page.Name = RequireName(request.Name);
            page.Description = NormalizeDescription(request.Description);
            page.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToPageResponse(page);
        }

        public async Task DeletePageAsync(Guid userId, Guid projectId, Guid pageId, CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            var page = await RequirePageAsync(projectId, pageId, cancellationToken);

            page.IsDeleted = true;
            page.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<PageVersionResponse>> ListPageVersionsAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: false, cancellationToken);
            await RequirePageAsync(projectId, pageId, cancellationToken);

            var versions = await _dbContext.PageVersions
                .AsNoTracking()
                .Where(x => x.PageId == pageId && !x.IsDeleted)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            return versions.Select(ToPageVersionResponse).ToArray();
        }

        public async Task<PageVersionResponse> CreatePageVersionAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            CreatePageVersionRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageAsync(projectId, pageId, cancellationToken);

            var now = DateTime.UtcNow;
            var version = new PageVersion
            {
                Id = Guid.NewGuid(),
                PageId = pageId,
                Name = RequireName(request.Name),
                IsDefault = false,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _dbContext.PageVersions.Add(version);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToPageVersionResponse(version);
        }

        public async Task<PageVersionResponse> UpdatePageVersionAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            UpdatePageVersionRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageAsync(projectId, pageId, cancellationToken);
            var version = await RequirePageVersionAsync(pageId, pageVersionId, cancellationToken);

            version.Name = RequireName(request.Name);
            version.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToPageVersionResponse(version);
        }

        public async Task DeletePageVersionAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageAsync(projectId, pageId, cancellationToken);
            var version = await RequirePageVersionAsync(pageId, pageVersionId, cancellationToken);

            version.IsDeleted = true;
            if (version.IsDefault)
            {
                version.IsDefault = false;
            }

            version.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<PageVersionResponse> SetDefaultPageVersionAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageAsync(projectId, pageId, cancellationToken);
            var version = await RequirePageVersionAsync(pageId, pageVersionId, cancellationToken);

            await ClearDefaultPageVersionAsync(pageId, pageVersionId, cancellationToken);
            version.IsDefault = true;
            version.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToPageVersionResponse(version);
        }

        public async Task<IReadOnlyList<ResourceResponse>> ListResourcesAsync(
            Guid userId,
            Guid projectId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: false, cancellationToken);

            var resources = await _dbContext.Resources
                .AsNoTracking()
                .Where(x => x.ProjectId == projectId && !x.IsDeleted)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            return resources.Select(ToResourceResponse).ToArray();
        }

        public async Task<ResourceResponse> CreateResourceAsync(
            Guid userId,
            Guid projectId,
            CreateResourceRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            var key = RequireName(request.Key);

            var now = DateTime.UtcNow;
            var resource = new Resource
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Name = key,
                NormalizedName = key.ToLowerInvariant(),
                Description = NormalizeDescription(request.Description),
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _dbContext.Resources.Add(resource);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourceResponse(resource);
        }

        public async Task<ResourceResponse> UpdateResourceAsync(
            Guid userId,
            Guid projectId,
            Guid resourceId,
            UpdateResourceRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            var resource = await RequireResourceAsync(projectId, resourceId, cancellationToken);

            var key = RequireName(request.Key);
            resource.Name = key;
            resource.NormalizedName = key.ToLowerInvariant();
            resource.Description = NormalizeDescription(request.Description);
            resource.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourceResponse(resource);
        }

        public async Task DeleteResourceAsync(Guid userId, Guid projectId, Guid resourceId, CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            var resource = await RequireResourceAsync(projectId, resourceId, cancellationToken);

            resource.IsDeleted = true;
            resource.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<IReadOnlyList<ResourceVersionResponse>> ListResourceVersionsAsync(
            Guid userId,
            Guid projectId,
            Guid resourceId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: false, cancellationToken);
            await RequireResourceAsync(projectId, resourceId, cancellationToken);

            var versions = await _dbContext.ResourceVersions
                .AsNoTracking()
                .Where(x => x.ResourceId == resourceId && !x.IsDeleted)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            return versions.Select(ToResourceVersionResponse).ToArray();
        }

        public async Task<ResourceVersionResponse> CreateResourceVersionAsync(
            Guid userId,
            Guid projectId,
            Guid resourceId,
            CreateResourceVersionRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequireResourceAsync(projectId, resourceId, cancellationToken);

            var now = DateTime.UtcNow;
            var version = new ResourceVersion
            {
                Id = Guid.NewGuid(),
                ResourceId = resourceId,
                Name = RequireName(request.Name),
                Value = RequireValue(request.Value),
                IsDefault = false,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _dbContext.ResourceVersions.Add(version);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourceVersionResponse(version);
        }

        public async Task<ResourceVersionResponse> UpdateResourceVersionAsync(
            Guid userId,
            Guid projectId,
            Guid resourceId,
            Guid resourceVersionId,
            UpdateResourceVersionRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequireResourceAsync(projectId, resourceId, cancellationToken);
            var version = await RequireResourceVersionAsync(resourceId, resourceVersionId, cancellationToken);

            version.Name = RequireName(request.Name);
            version.Value = RequireValue(request.Value);
            version.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourceVersionResponse(version);
        }

        public async Task DeleteResourceVersionAsync(
            Guid userId,
            Guid projectId,
            Guid resourceId,
            Guid resourceVersionId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequireResourceAsync(projectId, resourceId, cancellationToken);
            var version = await RequireResourceVersionAsync(resourceId, resourceVersionId, cancellationToken);

            version.IsDeleted = true;
            if (version.IsDefault)
            {
                version.IsDefault = false;
            }

            version.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<ResourceVersionResponse> SetDefaultResourceVersionAsync(
            Guid userId,
            Guid projectId,
            Guid resourceId,
            Guid resourceVersionId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequireResourceAsync(projectId, resourceId, cancellationToken);
            var version = await RequireResourceVersionAsync(resourceId, resourceVersionId, cancellationToken);

            await ClearDefaultResourceVersionAsync(resourceId, resourceVersionId, cancellationToken);
            version.IsDefault = true;
            version.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourceVersionResponse(version);
        }

        public async Task<IReadOnlyList<ResourcePageResponse>> ListResourcePagesAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: false, cancellationToken);
            await RequirePageVersionFromHierarchyAsync(projectId, pageId, pageVersionId, cancellationToken);

            var resourcePages = await _dbContext.ResourcePages
                .AsNoTracking()
                .Where(x => x.PageVersionId == pageVersionId && !x.IsDeleted)
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            return resourcePages.Select(ToResourcePageResponse).ToArray();
        }

        public async Task<ResourcePageResponse> CreateResourcePageAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CreateResourcePageRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageVersionFromHierarchyAsync(projectId, pageId, pageVersionId, cancellationToken);
            var resourceVersionId = await ResolveResourceVersionIdAsync(projectId, request.ResourceVersionId, request.ResourceId, cancellationToken);

            var now = DateTime.UtcNow;
            var resourcePage = new ResourcePage
            {
                Id = Guid.NewGuid(),
                PageVersionId = pageVersionId,
                ResourceVersionId = resourceVersionId,
                CreatedAt = now,
                UpdatedAt = now,
                IsDeleted = false
            };

            _dbContext.ResourcePages.Add(resourcePage);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourcePageResponse(resourcePage);
        }

        public async Task<ResourcePageResponse> UpdateResourcePageAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            Guid resourcePageId,
            UpdateResourcePageRequest request,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageVersionFromHierarchyAsync(projectId, pageId, pageVersionId, cancellationToken);
            var resourcePage = await RequireResourcePageAsync(pageVersionId, resourcePageId, cancellationToken);

            var resourceVersionId = await ResolveResourceVersionIdAsync(projectId, request.ResourceVersionId, request.ResourceId, cancellationToken);
            resourcePage.ResourceVersionId = resourceVersionId;
            resourcePage.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
            return ToResourcePageResponse(resourcePage);
        }

        public async Task DeleteResourcePageAsync(
            Guid userId,
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            Guid resourcePageId,
            CancellationToken cancellationToken)
        {
            await RequireProjectAccessAsync(userId, projectId, requiresManagePermission: true, cancellationToken);
            await RequirePageVersionFromHierarchyAsync(projectId, pageId, pageVersionId, cancellationToken);
            var resourcePage = await RequireResourcePageAsync(pageVersionId, resourcePageId, cancellationToken);

            resourcePage.IsDeleted = true;
            resourcePage.UpdatedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        private async Task<Project> RequireProjectAccessAsync(
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
                throw new NavigationException(HttpStatusCode.NotFound, "Project not found.");
            }

            if (project.OwnerUserId == userId)
            {
                return project;
            }

            var membership = project.Members.FirstOrDefault(x => x.UserId == userId && !x.IsDeleted);
            if (membership == null)
            {
                throw new NavigationException(HttpStatusCode.Forbidden, "You do not have access to this project.");
            }

            if (requiresManagePermission
                && !string.Equals(membership.Role, "admin", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(membership.Role, "editor", StringComparison.OrdinalIgnoreCase))
            {
                throw new NavigationException(HttpStatusCode.Forbidden, "You do not have permission to modify this project.");
            }

            return project;
        }

        private async Task<Page> RequirePageAsync(Guid projectId, Guid pageId, CancellationToken cancellationToken)
        {
            var page = await _dbContext.Pages.FirstOrDefaultAsync(x => x.Id == pageId && !x.IsDeleted, cancellationToken);
            if (page == null)
            {
                throw new NavigationException(HttpStatusCode.NotFound, "Page not found.");
            }

            if (page.ProjectId != projectId)
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Page does not belong to project.");
            }

            return page;
        }

        private async Task<PageVersion> RequirePageVersionAsync(Guid pageId, Guid pageVersionId, CancellationToken cancellationToken)
        {
            var pageVersion = await _dbContext.PageVersions.FirstOrDefaultAsync(x => x.Id == pageVersionId && !x.IsDeleted, cancellationToken);
            if (pageVersion == null)
            {
                throw new NavigationException(HttpStatusCode.NotFound, "Page version not found.");
            }

            if (pageVersion.PageId != pageId)
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Page version does not belong to page.");
            }

            return pageVersion;
        }

        private async Task<PageVersion> RequirePageVersionFromHierarchyAsync(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            await RequirePageAsync(projectId, pageId, cancellationToken);
            return await RequirePageVersionAsync(pageId, pageVersionId, cancellationToken);
        }

        private async Task<Resource> RequireResourceAsync(Guid projectId, Guid resourceId, CancellationToken cancellationToken)
        {
            var resource = await _dbContext.Resources.FirstOrDefaultAsync(x => x.Id == resourceId && !x.IsDeleted, cancellationToken);
            if (resource == null)
            {
                throw new NavigationException(HttpStatusCode.NotFound, "Resource not found.");
            }

            if (resource.ProjectId != projectId)
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Resource does not belong to project.");
            }

            return resource;
        }

        private async Task<ResourceVersion> RequireResourceVersionAsync(
            Guid resourceId,
            Guid resourceVersionId,
            CancellationToken cancellationToken)
        {
            var resourceVersion = await _dbContext.ResourceVersions
                .FirstOrDefaultAsync(x => x.Id == resourceVersionId && !x.IsDeleted, cancellationToken);

            if (resourceVersion == null)
            {
                throw new NavigationException(HttpStatusCode.NotFound, "Resource version not found.");
            }

            if (resourceVersion.ResourceId != resourceId)
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Resource version does not belong to resource.");
            }

            return resourceVersion;
        }

        private async Task<ResourcePage> RequireResourcePageAsync(
            Guid pageVersionId,
            Guid resourcePageId,
            CancellationToken cancellationToken)
        {
            var resourcePage = await _dbContext.ResourcePages
                .FirstOrDefaultAsync(x => x.Id == resourcePageId && !x.IsDeleted, cancellationToken);

            if (resourcePage == null)
            {
                throw new NavigationException(HttpStatusCode.NotFound, "Resource page not found.");
            }

            if (resourcePage.PageVersionId != pageVersionId)
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Resource page does not belong to page version.");
            }

            return resourcePage;
        }

        private async Task<Guid> ResolveResourceVersionIdAsync(
            Guid projectId,
            string? resourceVersionIdRaw,
            string? resourceIdRaw,
            CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(resourceVersionIdRaw))
            {
                if (!Guid.TryParse(resourceVersionIdRaw, out var resourceVersionId))
                {
                    throw new NavigationException(HttpStatusCode.BadRequest, "Invalid resourceVersionId.");
                }

                var resourceVersion = await _dbContext.ResourceVersions
                    .Include(x => x.Resource)
                    .FirstOrDefaultAsync(x => x.Id == resourceVersionId && !x.IsDeleted, cancellationToken);

                if (resourceVersion == null)
                {
                    throw new NavigationException(HttpStatusCode.NotFound, "Resource version not found.");
                }

                if (resourceVersion.Resource.ProjectId != projectId)
                {
                    throw new NavigationException(HttpStatusCode.BadRequest, "Resource version does not belong to project.");
                }

                return resourceVersion.Id;
            }

            if (string.IsNullOrWhiteSpace(resourceIdRaw))
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "resourceVersionId or resourceId is required.");
            }

            if (!Guid.TryParse(resourceIdRaw, out var resourceId))
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Invalid resourceId.");
            }

            var resource = await RequireResourceAsync(projectId, resourceId, cancellationToken);

            var selectedVersion = await _dbContext.ResourceVersions
                .Where(x => x.ResourceId == resource.Id && !x.IsDeleted)
                .OrderByDescending(x => x.IsDefault)
                .ThenByDescending(x => x.UpdatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (selectedVersion == null)
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Resource has no active versions.");
            }

            return selectedVersion.Id;
        }

        private async Task ClearDefaultPageVersionAsync(Guid pageId, Guid exceptVersionId, CancellationToken cancellationToken)
        {
            var defaults = await _dbContext.PageVersions
                .Where(x => x.PageId == pageId && !x.IsDeleted && x.IsDefault && x.Id != exceptVersionId)
                .ToListAsync(cancellationToken);

            foreach (var current in defaults)
            {
                current.IsDefault = false;
                current.UpdatedAt = DateTime.UtcNow;
            }
        }

        private async Task ClearDefaultResourceVersionAsync(Guid resourceId, Guid exceptVersionId, CancellationToken cancellationToken)
        {
            var defaults = await _dbContext.ResourceVersions
                .Where(x => x.ResourceId == resourceId && !x.IsDeleted && x.IsDefault && x.Id != exceptVersionId)
                .ToListAsync(cancellationToken);

            foreach (var current in defaults)
            {
                current.IsDefault = false;
                current.UpdatedAt = DateTime.UtcNow;
            }
        }

        private static string RequireName(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "The name field is required.");
            }

            return value.Trim();
        }

        private static string RequireValue(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "The value field is required.");
            }

            return value.Trim();
        }

        private static string? NormalizeDescription(string? description)
        {
            if (string.IsNullOrWhiteSpace(description))
            {
                return null;
            }

            return description.Trim();
        }

        private static PageResponse ToPageResponse(Page page)
        {
            return new PageResponse
            {
                Id = page.Id.ToString(),
                ProjectId = page.ProjectId.ToString(),
                Name = page.Name,
                Description = page.Description,
                CreatedAt = page.CreatedAt,
                UpdatedAt = page.UpdatedAt,
                IsDeleted = page.IsDeleted
            };
        }

        private static PageVersionResponse ToPageVersionResponse(PageVersion version)
        {
            return new PageVersionResponse
            {
                Id = version.Id.ToString(),
                PageId = version.PageId.ToString(),
                Name = version.Name,
                IsDefault = version.IsDefault,
                CreatedAt = version.CreatedAt,
                UpdatedAt = version.UpdatedAt,
                IsDeleted = version.IsDeleted
            };
        }

        private static ResourceResponse ToResourceResponse(Resource resource)
        {
            return new ResourceResponse
            {
                Id = resource.Id.ToString(),
                ProjectId = resource.ProjectId.ToString(),
                Key = resource.Name,
                Description = resource.Description,
                CreatedAt = resource.CreatedAt,
                UpdatedAt = resource.UpdatedAt,
                IsDeleted = resource.IsDeleted
            };
        }

        private static ResourceVersionResponse ToResourceVersionResponse(ResourceVersion version)
        {
            return new ResourceVersionResponse
            {
                Id = version.Id.ToString(),
                ResourceId = version.ResourceId.ToString(),
                Name = version.Name,
                Value = version.Value,
                IsDefault = version.IsDefault,
                CreatedAt = version.CreatedAt,
                UpdatedAt = version.UpdatedAt,
                IsDeleted = version.IsDeleted
            };
        }

        private static ResourcePageResponse ToResourcePageResponse(ResourcePage resourcePage)
        {
            return new ResourcePageResponse
            {
                Id = resourcePage.Id.ToString(),
                PageVersionId = resourcePage.PageVersionId.ToString(),
                ResourceVersionId = resourcePage.ResourceVersionId.ToString(),
                CreatedAt = resourcePage.CreatedAt,
                UpdatedAt = resourcePage.UpdatedAt,
                IsDeleted = resourcePage.IsDeleted
            };
        }
    }
}
