namespace resources_api.Models
{
    public class Page
    {
        public Guid Id { get; set; }

        public Guid ProjectId { get; set; }

        public required string Name { get; set; }

        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public Project Project { get; set; } = null!;

        public ICollection<PageVersion> Versions { get; set; } = new List<PageVersion>();
    }
}
