namespace resources_api.Models
{
    public class Resource
    {
        public Guid Id { get; set; }

        public Guid PageVersionId { get; set; }

        public required string Name { get; set; }

        public string? NormalizedName { get; set; }

        public string? Description { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public PageVersion PageVersion { get; set; } = null!;

        public ICollection<ResourceVersion> Versions { get; set; } = new List<ResourceVersion>();
    }
}
