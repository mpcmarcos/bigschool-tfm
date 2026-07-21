using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class SocialLoginRequest
    {
        [Required]
        public string? Provider { get; set; }

        [Required]
        public string? IdToken { get; set; }
    }
}
