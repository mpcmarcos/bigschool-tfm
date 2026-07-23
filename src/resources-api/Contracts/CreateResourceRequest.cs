using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class CreateResourceRequest
    {
        [Required]
        [MaxLength(200)]
        public string? Key { get; set; }

        [MaxLength(2000)]
        public string? Description { get; set; }
    }
}
