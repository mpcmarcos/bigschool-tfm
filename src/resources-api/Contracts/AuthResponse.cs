namespace resources_api.Contracts
{
    public class AuthResponse
    {
        public required string AccessToken { get; set; }

        public required string RefreshToken { get; set; }

        public required string TokenType { get; set; }

        public required int ExpiresIn { get; set; }

        public required UserProfileResponse User { get; set; }
    }
}
