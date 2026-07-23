namespace resources_api.Models
{
    public class ProjectMember
    {
        public Guid Id { get; set; }

        public Guid ProjectId { get; set; }

        public Guid UserId { get; set; }

        public required string Role { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public Project Project { get; set; } = null!;

        public User User { get; set; } = null!;
    }
}
