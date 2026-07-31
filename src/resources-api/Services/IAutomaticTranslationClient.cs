namespace resources_api.Services;

public sealed record AutomaticTranslationInput(
    string SourceLanguageCode,
    string SourceValue,
    IReadOnlyList<string> TargetLanguageCodes);

public sealed record GeneratedTranslation(string LanguageCode, string Value);

public enum TranslationProviderFailure
{
    InvalidResponse,
    Unavailable
}

public sealed class AutomaticTranslationProviderException : Exception
{
    public AutomaticTranslationProviderException(TranslationProviderFailure failure, string message, Exception? innerException = null)
        : base(message, innerException) => Failure = failure;

    public TranslationProviderFailure Failure { get; }
}

public interface IAutomaticTranslationClient
{
    Task<IReadOnlyList<GeneratedTranslation>> GenerateAsync(
        AutomaticTranslationInput input,
        CancellationToken cancellationToken);
}