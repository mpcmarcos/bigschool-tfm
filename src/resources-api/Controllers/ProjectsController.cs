using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using resources_api.Contracts;
using resources_api.Services;

namespace resources_api.Controllers
{
    [Route("api/v1/projects")]
    [ApiController]
    [Authorize]
    public class ProjectsController : ControllerBase
    {
        private readonly ProjectService _projectService;

        public ProjectsController(ProjectService projectService)
        {
            _projectService = projectService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<ProjectResponse>>> GetProjects(CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            return Ok(await _projectService.ListAccessibleProjectsAsync(userId, cancellationToken));
        }

        [HttpPost]
        public async Task<ActionResult<ProjectResponse>> CreateProject([FromBody] CreateProjectRequest request, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var project = await _projectService.CreateProjectAsync(userId, request, cancellationToken);
                return Created($"/api/v1/projects/{project.Id}", project);
            }
            catch (ProjectException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPut("{projectId:guid}")]
        public async Task<ActionResult<ProjectResponse>> UpdateProject(
            Guid projectId,
            [FromBody] UpdateProjectRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _projectService.UpdateProjectAsync(userId, projectId, request, cancellationToken));
            }
            catch (ProjectException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpDelete("{projectId:guid}")]
        public async Task<ActionResult> DeleteProject(Guid projectId, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                await _projectService.SoftDeleteProjectAsync(userId, projectId, cancellationToken);
                return NoContent();
            }
            catch (ProjectException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpGet("{projectId:guid}/members")]
        public async Task<ActionResult<IReadOnlyList<ProjectMemberResponse>>> GetMembers(Guid projectId, CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                return Ok(await _projectService.GetMembersAsync(userId, projectId, cancellationToken));
            }
            catch (ProjectException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("{projectId:guid}/members")]
        public async Task<ActionResult<ProjectMemberResponse>> ShareProject(
            Guid projectId,
            [FromBody] ShareProjectMemberRequest request,
            CancellationToken cancellationToken)
        {
            if (!TryGetUserId(out var userId))
            {
                return BuildProblem(new ProjectException(HttpStatusCode.Unauthorized, "User is not authenticated."));
            }

            try
            {
                var member = await _projectService.ShareProjectAsync(userId, projectId, request, cancellationToken);
                return Created($"/api/v1/projects/{projectId}/members/{member.Id}", member);
            }
            catch (ProjectException exception)
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

        private ActionResult BuildProblem(ProjectException exception)
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
