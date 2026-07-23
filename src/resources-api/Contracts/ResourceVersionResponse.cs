namespace resources_api.Contracts
{
    public class ResourceVersionResponse
    {
        public required string Id { get; set; }

        public required string ResourceId { get; set; }

        public required string Name { get; set; }

        public required string Value { get; set; }

        public required bool IsDefault { get; set; }

        public required DateTime CreatedAt { get; set; }

        public required DateTime UpdatedAt { get; set; }

        public required bool IsDeleted { get; set; }
    }
}
