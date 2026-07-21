using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class RefreshTokenRequest
    {
        [Required]
        public string? RefreshToken { get; set; }
    }
}
