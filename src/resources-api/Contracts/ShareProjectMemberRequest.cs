using System.ComponentModel.DataAnnotations;

namespace resources_api.Contracts
{
    public class ShareProjectMemberRequest
    {
        [Required]
        [EmailAddress]
        public string? Email { get; set; }

        [MaxLength(20)]
        public string? Role { get; set; } = "viewer";
    }
}
