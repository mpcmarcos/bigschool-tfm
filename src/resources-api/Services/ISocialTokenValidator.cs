namespace resources_api.Services
{
    public interface ISocialTokenValidator
    {
        Task<SocialIdentity> ValidateGoogleTokenAsync(string idToken, CancellationToken cancellationToken);
    }
}
