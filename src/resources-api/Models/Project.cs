namespace resources_api.Models
{
    public class Project
    {
        public Guid Id { get; set; }

        public required string Name { get; set; }

        public string? Description { get; set; }

        public Guid OwnerUserId { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public User OwnerUser { get; set; } = null!;

        public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
    }
}
