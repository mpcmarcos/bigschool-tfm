namespace resources_api.Contracts
{
    public class ProjectResponse
    {
        public required string Id { get; set; }

        public required string Name { get; set; }

        public string? Description { get; set; }

        public required string OwnerUserId { get; set; }

        public required string OwnerEmail { get; set; }

        public required DateTime CreatedAt { get; set; }

        public required DateTime UpdatedAt { get; set; }

        public required bool IsDeleted { get; set; }
    }
}
