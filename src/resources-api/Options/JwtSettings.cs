namespace resources_api.Options
{
    public class JwtSettings
    {
        public string Issuer { get; set; } = "resources-api";

        public string Audience { get; set; } = "resources-app";

        public int AccessTokenMinutes { get; set; } = 15;

        public int RefreshTokenDays { get; set; } = 30;

        public string SigningKey { get; set; } = "development-signing-key-change-me";
    }
}
