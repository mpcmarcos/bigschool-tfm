namespace resources_api.Models
{
    public class ResourcePage
    {
        public Guid Id { get; set; }

        public Guid PageVersionId { get; set; }

        public Guid ResourceVersionId { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }

        public bool IsDeleted { get; set; }

        public PageVersion PageVersion { get; set; } = null!;

        public ResourceVersion ResourceVersion { get; set; } = null!;
    }
}
