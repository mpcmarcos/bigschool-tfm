using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using resources_api.Contracts;
using resources_api.Services;

namespace resources_api.Controllers
{
    [Route("api/v1")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("auth/social/login")]
        public async Task<ActionResult<AuthResponse>> SocialLogin([FromBody] SocialLoginRequest request, CancellationToken cancellationToken)
        {
            try
            {
                return Ok(await _authService.LoginWithSocialAsync(request, cancellationToken));
            }
            catch (AuthException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("auth/refresh")]
        public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
        {
            try
            {
                return Ok(await _authService.RefreshAsync(request, cancellationToken));
            }
            catch (AuthException exception)
            {
                return BuildProblem(exception);
            }
        }

        [HttpPost("auth/logout")]
        public async Task<ActionResult> Logout([FromBody] RefreshTokenRequest request, CancellationToken cancellationToken)
        {
            try
            {
                await _authService.LogoutAsync(request, cancellationToken);
                return NoContent();
            }
            catch (AuthException exception)
            {
                return BuildProblem(exception);
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<ActionResult<UserProfileResponse>> Me(CancellationToken cancellationToken)
        {
            var userIdValue = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdValue, out var userId))
            {
                return Problem(
                    statusCode: StatusCodes.Status401Unauthorized,
                    detail: "User is not authenticated.",
                    type: "https://tools.ietf.org/html/rfc9110#section-15.5.2");
            }

            try
            {
                return Ok(await _authService.GetMeAsync(userId, cancellationToken));
            }
            catch (AuthException exception)
            {
                return BuildProblem(exception);
            }
        }

        private ActionResult BuildProblem(AuthException exception)
        {
            var statusCode = (int)exception.StatusCode;
            return Problem(
                statusCode: statusCode,
                detail: exception.Message,
                type: statusCode switch
                {
                    StatusCodes.Status400BadRequest => "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                    StatusCodes.Status401Unauthorized => "https://tools.ietf.org/html/rfc9110#section-15.5.2",
                    _ => "about:blank"
                });
        }
    }
}
