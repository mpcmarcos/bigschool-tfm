namespace resources_api.Models
{
    public class PageVersion
    {
        public Guid Id { get; set; }

        public Guid PageId { get; set; }

        public required string Name { get; set; }

        public bool IsDefault { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public Page Page { get; set; } = null!;

        public ICollection<ResourcePage> ResourcePages { get; set; } = new List<ResourcePage>();
    }
}
