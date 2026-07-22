namespace resources_api.Contracts
{
    public class ProjectMemberResponse
    {
        public required string Id { get; set; }

        public required string ProjectId { get; set; }

        public required string UserId { get; set; }

        public required string Email { get; set; }

        public required string Role { get; set; }

        public required DateTime CreatedAt { get; set; }

        public required DateTime UpdatedAt { get; set; }

        public required bool IsDeleted { get; set; }
    }
}
