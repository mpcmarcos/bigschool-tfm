namespace resources_api.Contracts
{
    public sealed class AutomaticTranslationsResponse
    {
        public required IReadOnlyList<ResourceVersionResponse> Translations { get; init; }
    }
}