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

        [Fact]
        public async Task Projects_Flow_CreateShareEditDelete_WorksAsExpected()
        {
            var client = _factory.CreateClient();
            var ownerSession = await LoginAsync(client, "owner-user", "owner@example.com");
            var ownerToken = ownerSession.GetProperty("accessToken").GetString()!;

            var createResponse = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Post,
                "/api/v1/projects",
                new
                {
                    name = "Proyecto Alpha",
                    description = "Proyecto inicial"
                });
            var createdProject = await createResponse.Content.ReadFromJsonAsync<JsonElement>();
            var projectId = createdProject.GetProperty("id").GetString();

            Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
            Assert.Equal("Proyecto Alpha", createdProject.GetProperty("name").GetString());
            Assert.Equal("Proyecto inicial", createdProject.GetProperty("description").GetString());
            Assert.False(createdProject.GetProperty("isDeleted").GetBoolean());

            var shareResponse = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Post,
                $"/api/v1/projects/{projectId}/members",
                new
                {
                    email = "collab@example.com",
                    role = "editor"
                });
            var sharedMember = await shareResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, shareResponse.StatusCode);
            Assert.Equal("collab@example.com", sharedMember.GetProperty("email").GetString());
            Assert.Equal("editor", sharedMember.GetProperty("role").GetString());

            var updateResponse = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Put,
                $"/api/v1/projects/{projectId}",
                new
                {
                    name = "Proyecto Alpha v2",
                    description = "Proyecto actualizado"
                });
            var updatedProject = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
            Assert.Equal("Proyecto Alpha v2", updatedProject.GetProperty("name").GetString());
            Assert.Equal("Proyecto actualizado", updatedProject.GetProperty("description").GetString());

            var ownerProjectsResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Get, "/api/v1/projects");
            var ownerProjects = await ownerProjectsResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.OK, ownerProjectsResponse.StatusCode);
            Assert.Contains(ownerProjects.EnumerateArray(), project => project.GetProperty("id").GetString() == projectId);

            var collabSession = await LoginAsync(client, "collab-user", "collab@example.com");
            var collabToken = collabSession.GetProperty("accessToken").GetString()!;
            var collabProjectsResponse = await SendAuthorizedAsync(client, collabToken, HttpMethod.Get, "/api/v1/projects");
            var collabProjects = await collabProjectsResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.OK, collabProjectsResponse.StatusCode);
            Assert.Contains(collabProjects.EnumerateArray(), project => project.GetProperty("id").GetString() == projectId);

            var membersResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Get, $"/api/v1/projects/{projectId}/members");
            var members = await membersResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.OK, membersResponse.StatusCode);
            Assert.Equal(2, members.GetArrayLength());

            var deleteResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Delete, $"/api/v1/projects/{projectId}");
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var projectsAfterDeleteResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Get, "/api/v1/projects");
            var projectsAfterDelete = await projectsAfterDeleteResponse.Content.ReadFromJsonAsync<JsonElement>();
            Assert.DoesNotContain(projectsAfterDelete.EnumerateArray(), project => project.GetProperty("id").GetString() == projectId);
        }

        [Fact]
        public async Task Projects_Create_WithoutAuth_ReturnsUnauthorized()
        {
            var client = _factory.CreateClient();
            var response = await client.PostAsJsonAsync("/api/v1/projects", new
            {
                name = "Proyecto sin auth",
                description = "No debe crearse"
            });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        private static async Task<JsonElement> LoginAsync(HttpClient client, string providerUserId, string email)
        {
            var response = await client.PostAsJsonAsync("/api/v1/auth/social/login", new
            {
                provider = "google",
                idToken = $"test-token:{providerUserId}:{email}"
            });

            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }

        private static async Task<HttpResponseMessage> SendAuthorizedAsync(
            HttpClient client,
            string accessToken,
            HttpMethod method,
            string path,
            object? payload = null)
        {
            var request = new HttpRequestMessage(method, path);
            request.Headers.Authorization = new("Bearer", accessToken);
            if (payload != null)
            {
                request.Content = JsonContent.Create(payload);
            }

            return await client.SendAsync(request);
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
