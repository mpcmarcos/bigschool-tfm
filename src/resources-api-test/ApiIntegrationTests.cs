using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using resources_api.Contracts;
using Xunit;

namespace resources_api_test
{
    public class ApiIntegrationTests : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly string _dbPath;

        public ApiIntegrationTests()
        {
            _dbPath = Path.Combine(Path.GetTempPath(), $"resources-api-test-{Guid.NewGuid():N}.db");
            _factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Testing");
                builder.ConfigureAppConfiguration((_, configBuilder) =>
                {
                    configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:Default"] = $"Data Source={_dbPath}"
                    });
                });
            });
        }

        [Fact]
        public async Task GetHealth_ReturnsOkStatusPayload()
        {
            var client = _factory.CreateClient();
            var response = await client.GetAsync("/health");
            var body = await response.Content.ReadFromJsonAsync<HealthResponse>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotNull(body);
            Assert.Equal("ok", body!.Status);
        }

        [Fact]
        public async Task PostEcho_ReturnsEchoedMessageAndApiSource()
        {
            var client = _factory.CreateClient();
            var response = await client.PostAsJsonAsync("/echo", new EchoRequest { Message = "hola" });
            var body = await response.Content.ReadFromJsonAsync<EchoResponse>();

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.NotNull(body);
            Assert.Equal("hola", body!.Message);
            Assert.Equal("api", body.Source);
        }

        [Fact]
        public async Task PostSocialLogin_ReturnsTokensAndUserPayload()
        {
            var client = _factory.CreateClient();
            var response = await client.PostAsJsonAsync("/api/v1/auth/social/login", new
            {
                provider = "google",
                idToken = "test-token:user-1:user1@example.com"
            });

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("Bearer", body.GetProperty("tokenType").GetString());
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("accessToken").GetString()));
            Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("refreshToken").GetString()));
            Assert.Equal("user1@example.com", body.GetProperty("user").GetProperty("email").GetString());
        }

        [Fact]
        public async Task GetMe_WithValidAccessToken_ReturnsCurrentUser()
        {
            var client = _factory.CreateClient();
            var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/social/login", new
            {
                provider = "google",
                idToken = "test-token:user-2:user2@example.com"
            });
            var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
            var accessToken = loginBody.GetProperty("accessToken").GetString();

            var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/me");
            request.Headers.Authorization = new("Bearer", accessToken);
            var meResponse = await client.SendAsync(request);
            var meBody = await meResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
            Assert.Equal("user2@example.com", meBody.GetProperty("email").GetString());
        }

        [Fact]
        public async Task RefreshToken_RotatesAndInvalidatesPreviousToken()
        {
            var client = _factory.CreateClient();
            var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/social/login", new
            {
                provider = "google",
                idToken = "test-token:user-3:user3@example.com"
            });
            var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
            var refreshToken = loginBody.GetProperty("refreshToken").GetString();

            var refreshResponse = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken });
            var refreshBody = await refreshResponse.Content.ReadFromJsonAsync<JsonElement>();
            var rotatedRefreshToken = refreshBody.GetProperty("refreshToken").GetString();

            var reusedResponse = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken });

            Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
            Assert.False(string.IsNullOrWhiteSpace(rotatedRefreshToken));
            Assert.NotEqual(refreshToken, rotatedRefreshToken);
            Assert.Equal(HttpStatusCode.Unauthorized, reusedResponse.StatusCode);
        }

        [Fact]
        public async Task Logout_RevokesRefreshToken()
        {
            var client = _factory.CreateClient();
            var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/social/login", new
            {
                provider = "google",
                idToken = "test-token:user-4:user4@example.com"
            });
            var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
            var refreshToken = loginBody.GetProperty("refreshToken").GetString();

            var logoutResponse = await client.PostAsJsonAsync("/api/v1/auth/logout", new { refreshToken });
            var refreshResponse = await client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken });

            Assert.Equal(HttpStatusCode.NoContent, logoutResponse.StatusCode);
            Assert.Equal(HttpStatusCode.Unauthorized, refreshResponse.StatusCode);
        }

        [Fact]
        public async Task SocialLogin_InvalidProvider_ReturnsProblemDetails()
        {
            var client = _factory.CreateClient();
            var response = await client.PostAsJsonAsync("/api/v1/auth/social/login", new
            {
                provider = "github",
                idToken = "test-token:user-5:user5@example.com"
            });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("https://tools.ietf.org/html/rfc9110#section-15.5.1", body.GetProperty("type").GetString());
            Assert.Equal("Invalid authentication provider.", body.GetProperty("detail").GetString());
        }

        public void Dispose()
        {
            _factory.Dispose();
            DeleteIfExists(_dbPath);
            DeleteIfExists($"{_dbPath}-wal");
            DeleteIfExists($"{_dbPath}-shm");
        }

        private static void DeleteIfExists(string path)
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
    }
}
