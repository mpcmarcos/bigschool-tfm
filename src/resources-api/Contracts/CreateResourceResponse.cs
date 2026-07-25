namespace resources_api.Contracts
{
    public class CreateResourceResponse
    {
        public required ResourceResponse Resource { get; set; }

        public required ResourceVersionResponse ResourceVersion { get; set; }
    }
}