using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using resources_api.Contracts;
using resources_api.Services;

namespace resources_api.Controllers
{
    [Route("api/v1/projects/{projectId:guid}")]
    [ApiController]
    [Authorize]
    public class NavigationController : ControllerBase
    {
        private readonly NavigationService _navigationService;

        public NavigationController(NavigationService navigationService)
        {
            _navigationService = navigationService;
        }

        [HttpGet("pages")]
        public async Task<ActionResult<IReadOnlyList<PageResponse>>> GetPages(Guid projectId, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.ListPagesAsync(userId, projectId, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("pages")]
        public async Task<ActionResult<PageResponse>> CreatePage(
            Guid projectId,
            [FromBody] CreatePageRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var created = await _navigationService.CreatePageAsync(userId, projectId, request, cancellationToken);
                return Created($"/api/v1/projects/{projectId}/pages/{created.Id}", created);
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPut("pages/{pageId:guid}")]
        public async Task<ActionResult<PageResponse>> UpdatePage(
            Guid projectId,
            Guid pageId,
            [FromBody] UpdatePageRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.UpdatePageAsync(userId, projectId, pageId, request, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpDelete("pages/{pageId:guid}")]
        public async Task<ActionResult> DeletePage(Guid projectId, Guid pageId, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                await _navigationService.DeletePageAsync(userId, projectId, pageId, cancellationToken);
                return NoContent();
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpGet("pages/{pageId:guid}/versions")]
        public async Task<ActionResult<IReadOnlyList<PageVersionResponse>>> GetPageVersions(
            Guid projectId,
            Guid pageId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.ListPageVersionsAsync(userId, projectId, pageId, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("pages/{pageId:guid}/versions")]
        public async Task<ActionResult<PageVersionResponse>> CreatePageVersion(
            Guid projectId,
            Guid pageId,
            [FromBody] CreatePageVersionRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var created = await _navigationService.CreatePageVersionAsync(userId, projectId, pageId, request, cancellationToken);
                return Created($"/api/v1/projects/{projectId}/pages/{pageId}/versions/{created.Id}", created);
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPut("pages/{pageId:guid}/versions/{pageVersionId:guid}")]
        public async Task<ActionResult<PageVersionResponse>> UpdatePageVersion(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            [FromBody] UpdatePageVersionRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.UpdatePageVersionAsync(
                    userId,
                    projectId,
                    pageId,
                    pageVersionId,
                    request,
                    cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpDelete("pages/{pageId:guid}/versions/{pageVersionId:guid}")]
        public async Task<ActionResult> DeletePageVersion(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                await _navigationService.DeletePageVersionAsync(userId, projectId, pageId, pageVersionId, cancellationToken);
                return NoContent();
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("pages/{pageId:guid}/versions/{pageVersionId:guid}/set-default")]
        public async Task<ActionResult<PageVersionResponse>> SetDefaultPageVersion(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.SetDefaultPageVersionAsync(
                    userId,
                    projectId,
                    pageId,
                    pageVersionId,
                    cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpGet("resources")]
        public async Task<ActionResult<IReadOnlyList<ResourceResponse>>> GetResources(Guid projectId, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.ListResourcesAsync(userId, projectId, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("resources")]
        public async Task<ActionResult<ResourceResponse>> CreateResource(
            Guid projectId,
            [FromBody] CreateResourceRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var created = await _navigationService.CreateResourceAsync(userId, projectId, request, cancellationToken);
                return Created($"/api/v1/projects/{projectId}/resources/{created.Id}", created);
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPut("resources/{resourceId:guid}")]
        public async Task<ActionResult<ResourceResponse>> UpdateResource(
            Guid projectId,
            Guid resourceId,
            [FromBody] UpdateResourceRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.UpdateResourceAsync(userId, projectId, resourceId, request, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpDelete("resources/{resourceId:guid}")]
        public async Task<ActionResult> DeleteResource(Guid projectId, Guid resourceId, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                await _navigationService.DeleteResourceAsync(userId, projectId, resourceId, cancellationToken);
                return NoContent();
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpGet("resources/{resourceId:guid}/versions")]
        public async Task<ActionResult<IReadOnlyList<ResourceVersionResponse>>> GetResourceVersions(
            Guid projectId,
            Guid resourceId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.ListResourceVersionsAsync(userId, projectId, resourceId, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("resources/{resourceId:guid}/versions")]
        public async Task<ActionResult<ResourceVersionResponse>> CreateResourceVersion(
            Guid projectId,
            Guid resourceId,
            [FromBody] CreateResourceVersionRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var created = await _navigationService.CreateResourceVersionAsync(userId, projectId, resourceId, request, cancellationToken);
                return Created($"/api/v1/projects/{projectId}/resources/{resourceId}/versions/{created.Id}", created);
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPut("resources/{resourceId:guid}/versions/{resourceVersionId:guid}")]
        public async Task<ActionResult<ResourceVersionResponse>> UpdateResourceVersion(
            Guid projectId,
            Guid resourceId,
            Guid resourceVersionId,
            [FromBody] UpdateResourceVersionRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.UpdateResourceVersionAsync(
                    userId,
                    projectId,
                    resourceId,
                    resourceVersionId,
                    request,
                    cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpDelete("resources/{resourceId:guid}/versions/{resourceVersionId:guid}")]
        public async Task<ActionResult> DeleteResourceVersion(
            Guid projectId,
            Guid resourceId,
            Guid resourceVersionId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                await _navigationService.DeleteResourceVersionAsync(userId, projectId, resourceId, resourceVersionId, cancellationToken);
                return NoContent();
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("resources/{resourceId:guid}/versions/{resourceVersionId:guid}/set-default")]
        public async Task<ActionResult<ResourceVersionResponse>> SetDefaultResourceVersion(
            Guid projectId,
            Guid resourceId,
            Guid resourceVersionId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.SetDefaultResourceVersionAsync(
                    userId,
                    projectId,
                    resourceId,
                    resourceVersionId,
                    cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpGet("pages/{pageId:guid}/versions/{pageVersionId:guid}/resource-pages")]
        public async Task<ActionResult<IReadOnlyList<ResourcePageResponse>>> GetResourcePages(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.ListResourcePagesAsync(userId, projectId, pageId, pageVersionId, cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("pages/{pageId:guid}/versions/{pageVersionId:guid}/resource-pages")]
        public async Task<ActionResult<ResourcePageResponse>> CreateResourcePage(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            [FromBody] CreateResourcePageRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var created = await _navigationService.CreateResourcePageAsync(
                    userId,
                    projectId,
                    pageId,
                    pageVersionId,
                    request,
                    cancellationToken);

                return Created(
                    $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages/{created.Id}",
                    created);
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPut("pages/{pageId:guid}/versions/{pageVersionId:guid}/resource-pages/{resourcePageId:guid}")]
        public async Task<ActionResult<ResourcePageResponse>> UpdateResourcePage(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            Guid resourcePageId,
            [FromBody] UpdateResourcePageRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _navigationService.UpdateResourcePageAsync(
                    userId,
                    projectId,
                    pageId,
                    pageVersionId,
                    resourcePageId,
                    request,
                    cancellationToken));
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpDelete("pages/{pageId:guid}/versions/{pageVersionId:guid}/resource-pages/{resourcePageId:guid}")]
        public async Task<ActionResult> DeleteResourcePage(
            Guid projectId,
            Guid pageId,
            Guid pageVersionId,
            Guid resourcePageId,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new NavigationException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                await _navigationService.DeleteResourcePageAsync(
                    userId,
                    projectId,
                    pageId,
                    pageVersionId,
                    resourcePageId,
                    cancellationToken);

                return NoContent();
            }
            catch (NavigationException exception)
            {
                return BuildProblem(exception);
            }
        }

        private bool TryGetUserId(out Guid userId)
        {
            var userIdValue = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            return Guid.TryParse(userIdValue, out userId);
        }

        private ActionResult BuildProblem(NavigationException exception)
        {
            var statusCode = (int)exception.StatusCode;
            return Problem(
                statusCode: statusCode,
                detail: exception.Message,
                type: statusCode switch
                {
                    StatusCodes.Status400BadRequest => "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                    StatusCodes.Status401Unauthorized => "https://tools.ietf.org/html/rfc9110#section-15.5.2",
                    StatusCodes.Status403Forbidden => "https://tools.ietf.org/html/rfc9110#section-15.5.4",
                    StatusCodes.Status404NotFound => "https://tools.ietf.org/html/rfc9110#section-15.5.5",
                    _ => "about:blank"
                });
        }
    }
}
