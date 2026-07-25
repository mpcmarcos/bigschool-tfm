using System.Net;

namespace resources_api.Services
{
    public static class SupportedLanguages
    {
        private static readonly HashSet<string> Codes = new(StringComparer.OrdinalIgnoreCase)
        {
            "pt-br",
            "es-es",
            "en-uk"
        };

        public static string NormalizeAndValidate(string? code)
        {
            var normalized = code?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(normalized) || !Codes.Contains(normalized))
            {
                throw new NavigationException(HttpStatusCode.BadRequest, "Unsupported language code.");
            }

            return normalized;
        }
    }
}