using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class CreateResourceVersionRequest
    {
        [Required]
        [MaxLength(20)]
        public string? LanguageCode { get; set; }

        [Required]
        public string? Value { get; set; }
    }
}
