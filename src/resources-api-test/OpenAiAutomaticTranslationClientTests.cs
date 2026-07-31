using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using resources_api.Options;
using resources_api.Services;
using Xunit;

namespace resources_api_test
{
    public class OpenAiAutomaticTranslationClientTests
    {
        [Fact]
        public async Task GenerateAsync_SendsExpectedRequest_AndParsesTranslations()
        {
            var responseBody = """
            {
              "status": "completed",
              "output": [
                {
                  "content": [
                    {
                      "type": "output_text",
                      "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Olá\"},{\"languageCode\":\"en-uk\",\"value\":\"Hello\"}]}"
                    }
                  ]
                }
              ]
            }
            """;

            var handler = new RecordingHttpMessageHandler(_ =>
            {
                var response = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(responseBody, Encoding.UTF8, "application/json")
                };
                return Task.FromResult(response);
            });

            var sut = CreateSut(handler);
            var input = new AutomaticTranslationInput("es-es", "Hola", new[] { "pt-br", "en-uk" });

            var result = await sut.GenerateAsync(input, CancellationToken.None);

            Assert.Equal("https://api.openai.com/v1/responses", handler.RequestUri!.ToString());
            Assert.Equal("test-key", handler.AuthorizationParameter);

            using var requestJson = JsonDocument.Parse(handler.RequestBody!);
            var root = requestJson.RootElement;
            Assert.Equal("test-model", root.GetProperty("model").GetString());
            Assert.False(root.GetProperty("store").GetBoolean());
            Assert.Equal("json_schema", root.GetProperty("text").GetProperty("format").GetProperty("type").GetString());
            Assert.True(root.GetProperty("text").GetProperty("format").GetProperty("strict").GetBoolean());
            Assert.False(root.TryGetProperty("tools", out _));
            Assert.False(root.TryGetProperty("conversation", out _));
            Assert.False(root.TryGetProperty("previous_response_id", out _));

            var schema = root.GetProperty("text").GetProperty("format").GetProperty("schema");
            Assert.False(schema.GetProperty("additionalProperties").GetBoolean());

            var translations = schema.GetProperty("properties").GetProperty("translations");
            Assert.Equal(2, translations.GetProperty("minItems").GetInt32());
            Assert.Equal(2, translations.GetProperty("maxItems").GetInt32());

            var item = translations.GetProperty("items");
            Assert.False(item.GetProperty("additionalProperties").GetBoolean());

            var enumValues = item
              .GetProperty("properties")
              .GetProperty("languageCode")
              .GetProperty("enum")
              .EnumerateArray()
              .Select(element => element.GetString())
              .ToArray();
            Assert.Equal(new[] { "pt-br", "en-uk" }, enumValues);

            Assert.Collection(
                result,
                first =>
                {
                    Assert.Equal("pt-br", first.LanguageCode);
                    Assert.Equal("Olá", first.Value);
                },
                second =>
                {
                    Assert.Equal("en-uk", second.LanguageCode);
                    Assert.Equal("Hello", second.Value);
                });
        }

        [Theory]
        [InlineData("missing API key", TranslationProviderFailure.Unavailable)]
        [InlineData("HTTP 429", TranslationProviderFailure.Unavailable)]
        [InlineData("HTTP 500", TranslationProviderFailure.Unavailable)]
        [InlineData("HTTP 400", TranslationProviderFailure.InvalidResponse)]
        [InlineData("status incomplete", TranslationProviderFailure.InvalidResponse)]
        [InlineData("content type refusal", TranslationProviderFailure.InvalidResponse)]
        [InlineData("missing output_text", TranslationProviderFailure.InvalidResponse)]
        [InlineData("multiple output_text", TranslationProviderFailure.InvalidResponse)]
        [InlineData("invalid output_text JSON", TranslationProviderFailure.InvalidResponse)]
        [InlineData("partial language results", TranslationProviderFailure.InvalidResponse)]
        [InlineData("duplicate language results", TranslationProviderFailure.InvalidResponse)]
        [InlineData("unexpected language results", TranslationProviderFailure.InvalidResponse)]
        [InlineData("TaskCanceledException timeout", TranslationProviderFailure.Unavailable)]
        public async Task GenerateAsync_MapsKnownFailures(string scenario, TranslationProviderFailure expectedFailure)
        {
            var timeoutTokenSource = new CancellationTokenSource();
            var handler = CreateHandlerForScenario(scenario);
            var sut = CreateSut(handler, configureOptions: options =>
            {
                if (scenario == "missing API key")
                {
                    options.ApiKey = string.Empty;
                }
            });

            var exception = await Assert.ThrowsAsync<AutomaticTranslationProviderException>(() =>
                sut.GenerateAsync(
                    new AutomaticTranslationInput("es-es", "Hola", new[] { "pt-br", "en-uk" }),
                    timeoutTokenSource.Token));

            Assert.Equal(expectedFailure, exception.Failure);
        }

        private static RecordingHttpMessageHandler CreateHandlerForScenario(string scenario)
        {
            return scenario switch
            {
                "HTTP 429" => BuildJsonHandler(HttpStatusCode.TooManyRequests, """
                    { "status": "incomplete" }
                    """),
                "HTTP 500" => BuildJsonHandler(HttpStatusCode.InternalServerError, """
                    { "status": "incomplete" }
                    """),
                "HTTP 400" => BuildJsonHandler(HttpStatusCode.BadRequest, """
                    { "status": "incomplete" }
                    """),
                "status incomplete" => BuildJsonHandler(HttpStatusCode.OK, """
                    { "status": "incomplete" }
                    """),
                "content type refusal" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "refusal",
                              "refusal": "Cannot comply"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "missing output_text" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "something_else",
                              "text": "ignored"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "multiple output_text" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "output_text",
                              "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Olá\"},{\"languageCode\":\"en-uk\",\"value\":\"Hello\"}]}"
                            },
                            {
                              "type": "output_text",
                              "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Oi\"},{\"languageCode\":\"en-uk\",\"value\":\"Hi\"}]}"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "invalid output_text JSON" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "output_text",
                              "text": "{ invalid json"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "partial language results" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "output_text",
                              "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Olá\"}]}"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "duplicate language results" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "output_text",
                              "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Olá\"},{\"languageCode\":\"pt-br\",\"value\":\"Hello\"}]}"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "unexpected language results" => BuildJsonHandler(HttpStatusCode.OK, """
                    {
                      "status": "completed",
                      "output": [
                        {
                          "content": [
                            {
                              "type": "output_text",
                              "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Olá\"},{\"languageCode\":\"fr-fr\",\"value\":\"Bonjour\"}]}"
                            }
                          ]
                        }
                      ]
                    }
                    """),
                "TaskCanceledException timeout" => new RecordingHttpMessageHandler(_ =>
                    throw new TaskCanceledException("timeout")),
                _ => BuildJsonHandler(HttpStatusCode.OK, """
                    { "status": "incomplete" }
                    """)
            };
        }

        private static RecordingHttpMessageHandler BuildJsonHandler(HttpStatusCode statusCode, string body)
        {
            return new RecordingHttpMessageHandler(_ =>
            {
                var response = new HttpResponseMessage(statusCode)
                {
                    Content = new StringContent(body, Encoding.UTF8, "application/json")
                };
                return Task.FromResult(response);
            });
        }

        private static OpenAiAutomaticTranslationClient CreateSut(
            RecordingHttpMessageHandler handler,
            Action<OpenAiOptions>? configureOptions = null)
        {
            var options = new OpenAiOptions
            {
                ApiKey = "test-key",
                BaseUrl = "https://api.openai.com/v1/",
                Model = "test-model",
                TimeoutSeconds = 60,
                MaxOutputTokens = 2000
            };
            configureOptions?.Invoke(options);

            var httpClient = new HttpClient(handler)
            {
                BaseAddress = new Uri(options.BaseUrl),
                Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds)
            };

            return new OpenAiAutomaticTranslationClient(httpClient, Options.Create(options));
        }

        private sealed class RecordingHttpMessageHandler : HttpMessageHandler
        {
            private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;

            public RecordingHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler)
            {
                _handler = handler;
            }

            public Uri? RequestUri { get; private set; }

            public string? AuthorizationParameter { get; private set; }

            public string? RequestBody { get; private set; }

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                RequestUri = request.RequestUri;
                AuthorizationParameter = request.Headers.Authorization?.Parameter;
                RequestBody = request.Content is null
                    ? null
                    : await request.Content.ReadAsStringAsync(cancellationToken);

                return await _handler(request);
            }
        }
    }
}