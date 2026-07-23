namespace resources_api.Contracts
{
    public class PageVersionResponse
    {
        public required string Id { get; set; }

        public required string PageId { get; set; }

        public required string Name { get; set; }

        public required bool IsDefault { get; set; }

        public required DateTime CreatedAt { get; set; }

        public required DateTime UpdatedAt { get; set; }

        public required bool IsDeleted { get; set; }
    }
}
