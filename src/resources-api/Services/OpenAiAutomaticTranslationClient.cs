using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using resources_api.Options;

namespace resources_api.Services;

public sealed class OpenAiAutomaticTranslationClient : IAutomaticTranslationClient
{
    private readonly HttpClient _httpClient;
    private readonly OpenAiOptions _options;

    public OpenAiAutomaticTranslationClient(HttpClient httpClient, IOptions<OpenAiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<IReadOnlyList<GeneratedTranslation>> GenerateAsync(
        AutomaticTranslationInput input,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey)
            || string.IsNullOrWhiteSpace(_options.Model)
            || string.IsNullOrWhiteSpace(_options.BaseUrl)
            || _options.TimeoutSeconds <= 0
            || _options.MaxOutputTokens <= 0)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.Unavailable,
                "OpenAI configuration is incomplete.");
        }

        var payload = new
        {
            model = _options.Model,
            store = false,
            max_output_tokens = _options.MaxOutputTokens,
            instructions = "Translate the source text into every requested target language. Preserve meaning, tone, capitalization, line breaks, HTML tags, technical fragments, and placeholders such as {name}, {{count}}, %s, and ${value}. Return only the structured result.",
            input = JsonSerializer.Serialize(new
            {
                sourceLanguageCode = input.SourceLanguageCode,
                sourceValue = input.SourceValue,
                targetLanguageCodes = input.TargetLanguageCodes
            }),
            text = new
            {
                format = new
                {
                    type = "json_schema",
                    name = "automatic_translations",
                    strict = true,
                    schema = BuildSchema(input.TargetLanguageCodes)
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, "responses")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request, cancellationToken);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.Unavailable,
                "The translation provider timed out.",
                ex);
        }
        catch (HttpRequestException ex)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.Unavailable,
                "The translation provider is unavailable.",
                ex);
        }

        if (response.StatusCode == HttpStatusCode.TooManyRequests || (int)response.StatusCode >= 500)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.Unavailable,
                "The translation provider is unavailable.");
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.InvalidResponse,
                "The translation provider returned an invalid response.");
        }

        try
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            var apiResponse = await JsonSerializer.DeserializeAsync<ResponsesApiResponse>(
                stream,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                cancellationToken);

            if (apiResponse is null)
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider returned an empty response.");
            }

            if (!string.Equals(apiResponse.Status, "completed", StringComparison.OrdinalIgnoreCase))
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider did not complete the response.");
            }

            var contentItems = apiResponse.Output?
                .SelectMany(output => output.Content ?? Enumerable.Empty<ResponsesContentItem>())
                .ToList() ?? new List<ResponsesContentItem>();

            if (contentItems.Any(item => string.Equals(item.Type, "refusal", StringComparison.OrdinalIgnoreCase)))
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider refused to generate a response.");
            }

            var outputTextItems = contentItems
                .Where(item => string.Equals(item.Type, "output_text", StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (outputTextItems.Count != 1)
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider response must include exactly one output_text block.");
            }

            var outputText = outputTextItems[0].Text;

            if (string.IsNullOrWhiteSpace(outputText))
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider response did not include output_text.");
            }

            var parsed = JsonSerializer.Deserialize<GeneratedTranslationsEnvelope>(
                outputText,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (parsed?.Translations is null)
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider response could not be parsed.");
            }

            if (!HasExactTargetSet(parsed.Translations, input.TargetLanguageCodes))
            {
                throw new AutomaticTranslationProviderException(
                    TranslationProviderFailure.InvalidResponse,
                    "The translation provider response languages did not match requested targets.");
            }

            return parsed.Translations;
        }
        catch (AutomaticTranslationProviderException)
        {
            throw;
        }
        catch (TaskCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.Unavailable,
                "The translation provider timed out.",
                ex);
        }
        catch (JsonException ex)
        {
            throw new AutomaticTranslationProviderException(
                TranslationProviderFailure.InvalidResponse,
                "The translation provider returned malformed JSON.",
                ex);
        }
    }

    private static bool HasExactTargetSet(
        IReadOnlyList<GeneratedTranslation> translations,
        IReadOnlyList<string> targetLanguageCodes)
    {
        if (translations.Count != targetLanguageCodes.Count)
        {
            return false;
        }

        var comparer = StringComparer.OrdinalIgnoreCase;

        var translationCodes = new HashSet<string>(comparer);
        foreach (var translation in translations)
        {
            if (string.IsNullOrWhiteSpace(translation.LanguageCode))
            {
                return false;
            }

            if (!translationCodes.Add(translation.LanguageCode))
            {
                return false;
            }
        }

        var targetCodes = new HashSet<string>(comparer);
        foreach (var targetLanguageCode in targetLanguageCodes)
        {
            if (string.IsNullOrWhiteSpace(targetLanguageCode))
            {
                return false;
            }

            if (!targetCodes.Add(targetLanguageCode))
            {
                return false;
            }
        }

        return translationCodes.SetEquals(targetCodes);
    }

    private static object BuildSchema(IReadOnlyList<string> targetLanguageCodes)
    {
        return new
        {
            type = "object",
            additionalProperties = false,
            required = new[] { "translations" },
            properties = new
            {
                translations = new
                {
                    type = "array",
                    minItems = targetLanguageCodes.Count,
                    maxItems = targetLanguageCodes.Count,
                    items = new
                    {
                        type = "object",
                        additionalProperties = false,
                        required = new[] { "languageCode", "value" },
                        properties = new
                        {
                            languageCode = new
                            {
                                type = "string",
                                @enum = targetLanguageCodes
                            },
                            value = new
                            {
                                type = "string"
                            }
                        }
                    }
                }
            }
        };
    }

    private sealed class ResponsesApiResponse
    {
        public string? Status { get; set; }

        public List<ResponsesOutputItem>? Output { get; set; }
    }

    private sealed class ResponsesOutputItem
    {
        public List<ResponsesContentItem>? Content { get; set; }
    }

    private sealed class ResponsesContentItem
    {
        public string? Type { get; set; }

        public string? Text { get; set; }
    }

    private sealed class GeneratedTranslationsEnvelope
    {
        public List<GeneratedTranslation>? Translations { get; set; }
    }
}