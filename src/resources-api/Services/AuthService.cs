using System.Net;
using Microsoft.EntityFrameworkCore;
using resources_api.Contracts;
using resources_api.Data;
using resources_api.Models;

namespace resources_api.Services
{
    public class AuthService
    {
        private readonly AppDbContext _dbContext;
        private readonly ISocialTokenValidator _socialTokenValidator;
        private readonly TokenService _tokenService;

        public AuthService(
            AppDbContext dbContext,
            ISocialTokenValidator socialTokenValidator,
            TokenService tokenService)
        {
            _dbContext = dbContext;
            _socialTokenValidator = socialTokenValidator;
            _tokenService = tokenService;
        }

        public async Task<AuthResponse> LoginWithSocialAsync(SocialLoginRequest request, CancellationToken cancellationToken)
        {
            if (!string.Equals(request.Provider, "google", StringComparison.OrdinalIgnoreCase))
            {
                throw new AuthException(HttpStatusCode.BadRequest, "Invalid authentication provider.");
            }

            if (string.IsNullOrWhiteSpace(request.IdToken))
            {
                throw new AuthException(HttpStatusCode.BadRequest, "The idToken field is required.");
            }

            var identity = await _socialTokenValidator.ValidateGoogleTokenAsync(request.IdToken, cancellationToken);
            var socialLogin = await _dbContext.UserSocialLogins
                .Include(x => x.User)
                .FirstOrDefaultAsync(
                    x => x.Provider == "google" && x.ProviderUserId == identity.ProviderUserId,
                    cancellationToken);

            User user;
            if (socialLogin == null)
            {
                user = await _dbContext.Users.FirstOrDefaultAsync(x => x.Email == identity.Email, cancellationToken)
                    ?? new User
                    {
                        Id = Guid.NewGuid(),
                        Email = identity.Email,
                        CreatedAt = DateTime.UtcNow,
                        LastLoginAt = DateTime.UtcNow
                    };

                if (_dbContext.Entry(user).State == EntityState.Detached)
                {
                    _dbContext.Users.Add(user);
                }

                _dbContext.UserSocialLogins.Add(new UserSocialLogin
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    Provider = "google",
                    ProviderUserId = identity.ProviderUserId,
                    ProviderEmail = identity.Email,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                user = socialLogin.User;
            }

            user.LastLoginAt = DateTime.UtcNow;
            var authResponse = await CreateAuthResponseAsync(user, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return authResponse;
        }

        public async Task<AuthResponse> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                throw new AuthException(HttpStatusCode.BadRequest, "The refreshToken field is required.");
            }

            var refreshTokenHash = TokenService.HashToken(request.RefreshToken);
            var now = DateTime.UtcNow;
            var token = await _dbContext.RefreshTokens
                .Include(x => x.User)
                .FirstOrDefaultAsync(
                    x => x.TokenHash == refreshTokenHash && x.RevokedAt == null && x.ExpiresAt > now,
                    cancellationToken);

            if (token == null)
            {
                throw new AuthException(HttpStatusCode.Unauthorized, "Invalid refresh token.");
            }

            var newRefreshToken = _tokenService.CreateRefreshToken();
            var newRefreshTokenHash = TokenService.HashToken(newRefreshToken);
            token.RevokedAt = now;
            token.ReplacedByTokenHash = newRefreshTokenHash;

            _dbContext.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = token.UserId,
                TokenHash = newRefreshTokenHash,
                CreatedAt = now,
                ExpiresAt = now.AddDays(_tokenService.RefreshTokenExpiresInDays)
            });

            await _dbContext.SaveChangesAsync(cancellationToken);
            return BuildResponse(token.User, _tokenService.CreateAccessToken(token.User), newRefreshToken);
        }

        public async Task LogoutAsync(RefreshTokenRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                throw new AuthException(HttpStatusCode.BadRequest, "The refreshToken field is required.");
            }

            var refreshTokenHash = TokenService.HashToken(request.RefreshToken);
            var token = await _dbContext.RefreshTokens
                .FirstOrDefaultAsync(x => x.TokenHash == refreshTokenHash && x.RevokedAt == null, cancellationToken);

            if (token == null)
            {
                throw new AuthException(HttpStatusCode.Unauthorized, "Invalid refresh token.");
            }

            token.RevokedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        public async Task<UserProfileResponse> GetMeAsync(Guid userId, CancellationToken cancellationToken)
        {
            var user = await _dbContext.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
            if (user == null)
            {
                throw new AuthException(HttpStatusCode.Unauthorized, "User is not authenticated.");
            }

            return ToUserProfile(user);
        }

        private async Task<AuthResponse> CreateAuthResponseAsync(User user, CancellationToken cancellationToken)
        {
            var refreshToken = _tokenService.CreateRefreshToken();
            _dbContext.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = TokenService.HashToken(refreshToken),
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(_tokenService.RefreshTokenExpiresInDays)
            });

            await Task.CompletedTask;
            return BuildResponse(user, _tokenService.CreateAccessToken(user), refreshToken);
        }

        private AuthResponse BuildResponse(User user, string accessToken, string refreshToken)
        {
            return new AuthResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                TokenType = "Bearer",
                ExpiresIn = _tokenService.AccessTokenExpiresInSeconds,
                User = ToUserProfile(user)
            };
        }

        private static UserProfileResponse ToUserProfile(User user)
        {
            return new UserProfileResponse
            {
                Id = user.Id.ToString(),
                Email = user.Email,
                LastLoginAt = user.LastLoginAt
            };
        }
    }
}
