namespace resources_api.Contracts
{
    public class PageResponse
    {
        public required string Id { get; set; }

        public required string ProjectId { get; set; }

        public required string Name { get; set; }

        public string? Description { get; set; }

        public required DateTime CreatedAt { get; set; }

        public required DateTime UpdatedAt { get; set; }

        public required bool IsDeleted { get; set; }
    }
}
