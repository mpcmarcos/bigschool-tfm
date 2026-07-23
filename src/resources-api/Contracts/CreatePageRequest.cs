using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class CreatePageRequest
    {
        [Required]
        [MaxLength(200)]
        public string? Name { get; set; }

        [MaxLength(2000)]
        public string? Description { get; set; }
    }
}
