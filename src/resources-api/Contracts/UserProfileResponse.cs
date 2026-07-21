namespace resources_api.Contracts
{
    public class UserProfileResponse
    {
        public required string Id { get; set; }

        public required string Email { get; set; }

        public required DateTime LastLoginAt { get; set; }
    }
}
