using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class UpdateResourceVersionRequest
    {
        [Required]
        [MaxLength(200)]
        public string? Name { get; set; }

        [Required]
        public string? Value { get; set; }
    }
}
