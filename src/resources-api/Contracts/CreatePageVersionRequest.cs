using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class CreatePageVersionRequest
    {
        [Required]
        [MaxLength(200)]
        public string? Name { get; set; }
    }
}
