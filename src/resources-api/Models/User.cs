namespace resources_api.Models
{
    public class User
    {
        public Guid Id { get; set; }

        public required string Email { get; set; }

        public DateTime LastLoginAt { get; set; }

        public DateTime CreatedAt { get; set; }

        public ICollection<UserSocialLogin> SocialLogins { get; set; } = new List<UserSocialLogin>();

        public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    }
}
