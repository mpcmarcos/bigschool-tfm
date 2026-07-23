namespace resources_api.Models
{
    public class ResourceVersion
    {
        public Guid Id { get; set; }

        public Guid ResourceId { get; set; }

        public required string Name { get; set; }

        public required string Value { get; set; }

        public bool IsDefault { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public Resource Resource { get; set; } = null!;

        public ICollection<ResourcePage> ResourcePages { get; set; } = new List<ResourcePage>();
    }
}
