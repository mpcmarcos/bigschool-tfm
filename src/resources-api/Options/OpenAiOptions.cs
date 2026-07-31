namespace resources_api.Options;

public sealed class OpenAiOptions
{
    public const string SectionName = "OpenAI";
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";
    public string Model { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 60;
    public int MaxOutputTokens { get; set; } = 2000;
}