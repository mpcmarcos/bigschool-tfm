namespace resources_api.Contracts
{
    public class ResourcePageResponse
    {
        public required string Id { get; set; }

        public required string PageVersionId { get; set; }

        public required string ResourceVersionId { get; set; }

        public required DateTime CreatedAt { get; set; }

        public required DateTime UpdatedAt { get; set; }

        public required bool IsDeleted { get; set; }
    }
}
