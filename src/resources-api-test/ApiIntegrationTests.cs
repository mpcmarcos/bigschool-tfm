using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using resources_api.Contracts;
using resources_api.Data;
using resources_api.Models;
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

        [Fact]
        public async Task Navigation_Flow_CreatePagePageVersionResourceResourceVersionResourcePage_WorksAsExpected()
        {
            var client = _factory.CreateClient();
            var ownerSession = await LoginAsync(client, "owner-nav", "owner-nav@example.com");
            var ownerToken = ownerSession.GetProperty("accessToken").GetString()!;

            var createProject = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, "/api/v1/projects", new
            {
                name = "Proyecto Navigation",
                description = "Base jerárquica"
            });
            var project = await createProject.Content.ReadFromJsonAsync<JsonElement>();
            var projectId = project.GetProperty("id").GetString()!;

            // Page
            var createPage = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages", new
            {
                name = "Home",
                description = "Página inicial"
            });
            Assert.Equal(HttpStatusCode.Created, createPage.StatusCode);
            var page = await createPage.Content.ReadFromJsonAsync<JsonElement>();
            var pageId = page.GetProperty("id").GetString()!;

            // Page Version
            var pageVersionResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions", new { name = "v1" });
            Assert.Equal(HttpStatusCode.Created, pageVersionResponse.StatusCode);
            var pageVersion = await pageVersionResponse.Content.ReadFromJsonAsync<JsonElement>();
            var pageVersionId = pageVersion.GetProperty("id").GetString()!;

            // Resource
            var resourceResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources", new { key = "hero.title", description = "Hero title" });
            Assert.Equal(HttpStatusCode.Created, resourceResponse.StatusCode);
            var resource = await resourceResponse.Content.ReadFromJsonAsync<JsonElement>();
            var resourceId = resource.GetProperty("id").GetString()!;

            // Resource Version
            var resourceVersionResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources/{resourceId}/versions", new { name = "rv1", value = "Hello" });
            Assert.Equal(HttpStatusCode.Created, resourceVersionResponse.StatusCode);
            var resourceVersion = await resourceVersionResponse.Content.ReadFromJsonAsync<JsonElement>();
            var resourceVersionId = resourceVersion.GetProperty("id").GetString()!;

            // Link ResourceVersion to PageVersion (ResourcePage)
            var resourcePageResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages", new
            {
                resourceVersionId = resourceVersionId
            });

            Assert.True(resourcePageResponse.StatusCode == HttpStatusCode.Created || resourcePageResponse.StatusCode == HttpStatusCode.OK);
        }

        [Fact]
        public async Task Navigation_Defaults_AreUniquePerParent()
        {
            var client = _factory.CreateClient();
            var ownerSession = await LoginAsync(client, "owner-defaults", "owner-defaults@example.com");
            var ownerToken = ownerSession.GetProperty("accessToken").GetString()!;

            var projectResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, "/api/v1/projects", new
            {
                name = "Proyecto Defaults",
                description = "Default único por padre"
            });
            var project = await projectResponse.Content.ReadFromJsonAsync<JsonElement>();
            var projectId = project.GetProperty("id").GetString()!;

            // Page versions default uniqueness
            var pageResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages", new { name = "Landing", description = "Landing" });
            var page = await pageResponse.Content.ReadFromJsonAsync<JsonElement>();
            var pageId = page.GetProperty("id").GetString()!;

            var v1Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions", new { name = "v1" });
            var v1 = await v1Response.Content.ReadFromJsonAsync<JsonElement>();
            var v1Id = v1.GetProperty("id").GetString()!;

            var v2Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions", new { name = "v2" });
            var v2 = await v2Response.Content.ReadFromJsonAsync<JsonElement>();
            var v2Id = v2.GetProperty("id").GetString()!;

            var setDefaultV1 = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{v1Id}/set-default");
            var setDefaultV2 = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{v2Id}/set-default");
            var versionsResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Get, $"/api/v1/projects/{projectId}/pages/{pageId}/versions");
            var versions = await versionsResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, setDefaultV1.StatusCode);
            Assert.Equal(HttpStatusCode.OK, setDefaultV2.StatusCode);
            Assert.Equal(1, versions.EnumerateArray().Count(x => x.GetProperty("isDefault").GetBoolean()));

            // Resource versions default uniqueness (per Resource)
            var resourceResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources", new { key = "hero.title", description = "Hero title" });
            Assert.Equal(HttpStatusCode.Created, resourceResponse.StatusCode);
            var resource = await resourceResponse.Content.ReadFromJsonAsync<JsonElement>();
            var resourceId = resource.GetProperty("id").GetString()!;

            var rv1Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources/{resourceId}/versions", new { name = "r1", value = "A" });
            var rv1 = await rv1Response.Content.ReadFromJsonAsync<JsonElement>();
            var rv1Id = rv1.GetProperty("id").GetString()!;

            var rv2Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources/{resourceId}/versions", new { name = "r2", value = "B" });
            var rv2 = await rv2Response.Content.ReadFromJsonAsync<JsonElement>();
            var rv2Id = rv2.GetProperty("id").GetString()!;

            var setDefaultRv1 = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources/{resourceId}/versions/{rv1Id}/set-default");
            var setDefaultRv2 = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/resources/{resourceId}/versions/{rv2Id}/set-default");
            var rversionsResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Get, $"/api/v1/projects/{projectId}/resources/{resourceId}/versions");
            var rversions = await rversionsResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, setDefaultRv1.StatusCode);
            Assert.Equal(HttpStatusCode.OK, setDefaultRv2.StatusCode);
            Assert.Equal(1, rversions.EnumerateArray().Count(x => x.GetProperty("isDefault").GetBoolean()));
        }

        [Fact]
        public async Task Navigation_InvalidHierarchy_ReturnsBadRequestOrNotFound()
        {
            var client = _factory.CreateClient();
            var ownerSession = await LoginAsync(client, "owner-hierarchy", "owner-hierarchy@example.com");
            var ownerToken = ownerSession.GetProperty("accessToken").GetString()!;

            var p1Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, "/api/v1/projects", new { name = "P1", description = "P1" });
            var p2Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, "/api/v1/projects", new { name = "P2", description = "P2" });
            var p1 = await p1Response.Content.ReadFromJsonAsync<JsonElement>();
            var p2 = await p2Response.Content.ReadFromJsonAsync<JsonElement>();
            var p1Id = p1.GetProperty("id").GetString()!;
            var p2Id = p2.GetProperty("id").GetString()!;

            var pageP1Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{p1Id}/pages", new { name = "Home P1", description = "Home P1" });
            var pageP1 = await pageP1Response.Content.ReadFromJsonAsync<JsonElement>();
            var pageP1Id = pageP1.GetProperty("id").GetString()!;
            var pageVersionP1Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{p1Id}/pages/{pageP1Id}/versions", new { name = "v1" });
            var pageVersionP1 = await pageVersionP1Response.Content.ReadFromJsonAsync<JsonElement>();
            var pageVersionP1Id = pageVersionP1.GetProperty("id").GetString()!;

            var resourceP2Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{p2Id}/resources", new { key = "hero.title", description = "Hero title" });
            var resourceP2 = await resourceP2Response.Content.ReadFromJsonAsync<JsonElement>();
            var resourceP2Id = resourceP2.GetProperty("id").GetString()!;

            var invalidResourcePageResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{p1Id}/pages/{pageP1Id}/versions/{pageVersionP1Id}/resource-pages", new
            {
                resourceId = resourceP2Id
            });

            Assert.True(invalidResourcePageResponse.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task Navigation_NonMemberAccess_ReturnsForbidden()
        {
            var client = _factory.CreateClient();
            var ownerSession = await LoginAsync(client, "owner-access", "owner-access@example.com");
            var ownerToken = ownerSession.GetProperty("accessToken").GetString()!;
            var outsiderSession = await LoginAsync(client, "outsider-access", "outsider-access@example.com");
            var outsiderToken = outsiderSession.GetProperty("accessToken").GetString()!;

            var projectResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, "/api/v1/projects", new
            {
                name = "Proyecto privado",
                description = "Sin compartir"
            });
            var project = await projectResponse.Content.ReadFromJsonAsync<JsonElement>();
            var projectId = project.GetProperty("id").GetString()!;

            var outsiderPagesResponse = await SendAuthorizedAsync(client, outsiderToken, HttpMethod.Get, $"/api/v1/projects/{projectId}/pages");
            var outsiderResourcesResponse = await SendAuthorizedAsync(client, outsiderToken, HttpMethod.Get, $"/api/v1/projects/{projectId}/resources");

            Assert.Equal(HttpStatusCode.Forbidden, outsiderPagesResponse.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, outsiderResourcesResponse.StatusCode);
        }

        [Fact]
        public void Navigation_Model_DoesNotCreateShadowResourceIdOnResourcePages()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=:memory:")
                .Options;
            using var context = new AppDbContext(options);
            var resourcePageEntity = context.Model.FindEntityType(typeof(ResourcePage));

            Assert.NotNull(resourcePageEntity);
            Assert.DoesNotContain(resourcePageEntity!.GetProperties(), property => property.Name == "ResourceId");
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
