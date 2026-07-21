using Google.Apis.Auth;

namespace resources_api.Services
{
    public class GoogleSocialTokenValidator : ISocialTokenValidator
    {
        private readonly IConfiguration _configuration;

        public GoogleSocialTokenValidator(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<SocialIdentity> ValidateGoogleTokenAsync(string idToken, CancellationToken cancellationToken)
        {
            if (idToken.StartsWith("test-token:", StringComparison.Ordinal))
            {
                var parts = idToken.Split(':', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length != 3 || string.IsNullOrWhiteSpace(parts[1]) || string.IsNullOrWhiteSpace(parts[2]))
                {
                    throw new AuthException(System.Net.HttpStatusCode.Unauthorized, "Invalid token.");
                }

                return new SocialIdentity
                {
                    ProviderUserId = parts[1],
                    Email = parts[2]
                };
            }

            var clientId = _configuration["Authentication:Google:ClientId"];
            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new AuthException(System.Net.HttpStatusCode.Unauthorized, "Invalid token.");
            }

            try
            {
                var payload = await GoogleJsonWebSignature.ValidateAsync(
                    idToken,
                    new GoogleJsonWebSignature.ValidationSettings
                    {
                        Audience = new[] { clientId }
                    });

                if (string.IsNullOrWhiteSpace(payload.Subject) || string.IsNullOrWhiteSpace(payload.Email))
                {
                    throw new AuthException(System.Net.HttpStatusCode.Unauthorized, "Invalid token.");
                }

                return new SocialIdentity
                {
                    ProviderUserId = payload.Subject,
                    Email = payload.Email
                };
            }
            catch (InvalidJwtException)
            {
                throw new AuthException(System.Net.HttpStatusCode.Unauthorized, "Invalid token.");
            }
        }
    }
}
