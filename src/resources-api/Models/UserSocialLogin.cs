namespace resources_api.Models
{
    public class UserSocialLogin
    {
        public Guid Id { get; set; }

        public Guid UserId { get; set; }

        public required string Provider { get; set; }

        public required string ProviderUserId { get; set; }

        public required string ProviderEmail { get; set; }

        public DateTime CreatedAt { get; set; }

        public User User { get; set; } = null!;
    }
}
