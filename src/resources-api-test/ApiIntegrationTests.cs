using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using resources_api.Contracts;
using resources_api.Data;
using resources_api.Models;
using resources_api.Services;
using Xunit;

namespace resources_api_test
{
    public class ApiIntegrationTests : IDisposable
    {
        private readonly WebApplicationFactory<Program> _factory;
        private readonly string _dbPath;
        private readonly FakeAutomaticTranslationClient _translationClient = new();
        private readonly AutomaticTranslationSaveFailureSwitch _saveFailureSwitch = new();

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
                builder.ConfigureServices(services =>
                {
                    services.RemoveAll<DbContextOptions<AppDbContext>>();
                    services.RemoveAll<AppDbContext>();
                    services.AddSingleton(_saveFailureSwitch);
                    services.AddSingleton<ThrowOnNextAutomaticTranslationSaveInterceptor>();
                    services.AddDbContext<AppDbContext>((serviceProvider, options) =>
                    {
                        options.UseSqlite($"Data Source={_dbPath}");
                        options.AddInterceptors(serviceProvider.GetRequiredService<ThrowOnNextAutomaticTranslationSaveInterceptor>());
                    });

                    services.RemoveAll<IAutomaticTranslationClient>();
                    services.AddSingleton<IAutomaticTranslationClient>(_translationClient);
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
        public async Task Navigation_Flow_CreatesResourceDirectlyInsidePageVersion()
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

            var resourceResponse = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Post,
                $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources",
                new
                {
                    key = "hero.title",
                    description = "Hero title",
                    languageCode = "es-es",
                    value = "Hola"
                });

            Assert.Equal(HttpStatusCode.Created, resourceResponse.StatusCode);
            var created = await resourceResponse.Content.ReadFromJsonAsync<JsonElement>();
            var resource = created.GetProperty("resource");
            var resourceId = resource.GetProperty("id").GetString()!;
            var resourceVersion = created.GetProperty("resourceVersion");

            Assert.Equal(pageVersionId, resource.GetProperty("pageVersionId").GetString());
            Assert.Equal(resourceId, resourceVersion.GetProperty("resourceId").GetString());
            Assert.Equal("es-es", resourceVersion.GetProperty("languageCode").GetString());
            Assert.Equal("Hola", resourceVersion.GetProperty("value").GetString());

            var resourcesResponse = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Get,
                $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources");
            var resources = await resourcesResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.OK, resourcesResponse.StatusCode);
            Assert.Single(resources.EnumerateArray());
            Assert.Equal(resourceId, resources[0].GetProperty("id").GetString());
        }

        [Fact]
        public async Task ResourceLanguages_NormalizeRejectDuplicatesAndAllowRecreationAfterDelete()
        {
            var client = _factory.CreateClient();
            var session = await LoginAsync(client, "owner-languages", "owner-languages@example.com");
            var token = session.GetProperty("accessToken").GetString()!;

            var projectResponse = await SendAuthorizedAsync(client, token, HttpMethod.Post, "/api/v1/projects", new { name = "Languages" });
            var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
            var pageResponse = await SendAuthorizedAsync(client, token, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages", new { name = "Home" });
            var pageId = (await pageResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
            var pageVersionResponse = await SendAuthorizedAsync(client, token, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions", new { name = "v1" });
            var pageVersionId = (await pageVersionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
            var resourceResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources",
                new { key = "hero.title", languageCode = "es-es", value = "Hola" });
            var resourceId = (await resourceResponse.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("resource")
                .GetProperty("id")
                .GetString()!;
            var versionsUrl = $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions";

            var portugueseResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                versionsUrl,
                new { languageCode = "PT-BR", value = "Olá" });
            var portuguese = await portugueseResponse.Content.ReadFromJsonAsync<JsonElement>();
            var portugueseId = portuguese.GetProperty("id").GetString()!;

            Assert.Equal(HttpStatusCode.Created, portugueseResponse.StatusCode);
            Assert.Equal("pt-br", portuguese.GetProperty("languageCode").GetString());
            Assert.False(portuguese.TryGetProperty("name", out _));
            Assert.False(portuguese.TryGetProperty("isDefault", out _));

            var duplicateResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                versionsUrl,
                new { languageCode = "pt-br", value = "Duplicado" });
            Assert.Equal(HttpStatusCode.Conflict, duplicateResponse.StatusCode);

            var unsupportedResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                versionsUrl,
                new { languageCode = "fr-fr", value = "Bonjour" });
            Assert.Equal(HttpStatusCode.BadRequest, unsupportedResponse.StatusCode);

            var deleteResponse = await SendAuthorizedAsync(client, token, HttpMethod.Delete, $"{versionsUrl}/{portugueseId}");
            Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

            var recreatedResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                versionsUrl,
                new { languageCode = "pt-br", value = "Olá novamente" });
            Assert.Equal(HttpStatusCode.Created, recreatedResponse.StatusCode);
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

            var pageP2Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{p2Id}/pages", new { name = "Home P2" });
            var pageP2Id = (await pageP2Response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
            var pageVersionP2Response = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{p2Id}/pages/{pageP2Id}/versions", new { name = "v1" });
            var pageVersionP2Id = (await pageVersionP2Response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
            var resourceP2Response = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Post,
                $"/api/v1/projects/{p2Id}/pages/{pageP2Id}/versions/{pageVersionP2Id}/resources",
                new { key = "hero.title", languageCode = "es-es", value = "Hola" });
            var resourceP2Id = (await resourceP2Response.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("resource")
                .GetProperty("id")
                .GetString()!;

            var invalidHierarchyResponse = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Get,
                $"/api/v1/projects/{p1Id}/pages/{pageP1Id}/versions/{pageVersionP1Id}/resources/{resourceP2Id}/versions");

            Assert.True(invalidHierarchyResponse.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound);
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
            var pageResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages", new { name = "Home" });
            var pageId = (await pageResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
            var pageVersionResponse = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages/{pageId}/versions", new { name = "v1" });
            var pageVersionId = (await pageVersionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

            var outsiderPagesResponse = await SendAuthorizedAsync(client, outsiderToken, HttpMethod.Get, $"/api/v1/projects/{projectId}/pages");
            var outsiderResourcesResponse = await SendAuthorizedAsync(
                client,
                outsiderToken,
                HttpMethod.Get,
                $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources");

            Assert.Equal(HttpStatusCode.Forbidden, outsiderPagesResponse.StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, outsiderResourcesResponse.StatusCode);
        }

        [Fact]
        public void Navigation_Model_UsesDirectPageVersionResourceHierarchy()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite("Data Source=:memory:")
                .Options;
            using var context = new AppDbContext(options);
            var resourceEntity = context.Model.FindEntityType(typeof(Resource));
            var resourceVersionEntity = context.Model.FindEntityType(typeof(ResourceVersion));

            Assert.Null(context.Model.FindEntityType("resources_api.Models.ResourcePage"));
            Assert.NotNull(resourceEntity!.FindProperty(nameof(Resource.PageVersionId)));
            Assert.Null(resourceEntity.FindProperty("ProjectId"));
            Assert.Null(resourceVersionEntity!.FindProperty("Name"));
            Assert.Null(resourceVersionEntity.FindProperty("IsDefault"));
            Assert.NotNull(resourceVersionEntity.FindProperty("LanguageCode"));
        }

        [Fact]
        public async Task AutomaticTranslations_HappyPath_ReturnsCreatedAndPersistsExactTargets()
        {
            _translationClient.Result = new[]
            {
                new GeneratedTranslation("pt-br", "Olá"),
                new GeneratedTranslation("en-uk", "Hello")
            };

            var client = _factory.CreateClient();
            var session = await LoginAsync(client, "owner-auto-happy", "owner-auto-happy@example.com");
            var token = session.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new
                {
                    sourceLanguageCode = "es-es"
                });

            var body = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
            var createdTranslations = body.GetProperty("translations")
                .EnumerateArray()
                .Select(x => new
                {
                    LanguageCode = x.GetProperty("languageCode").GetString(),
                    Value = x.GetProperty("value").GetString()
                })
                .ToArray();

            Assert.Equal(2, createdTranslations.Length);
            Assert.Collection(
                createdTranslations,
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

            var listResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Get,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/versions");
            var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
            var persistedByLanguage = listBody
                .EnumerateArray()
                .ToDictionary(
                    x => x.GetProperty("languageCode").GetString()!,
                    x => x.GetProperty("value").GetString()!,
                    StringComparer.OrdinalIgnoreCase);

            Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
            Assert.Equal(3, listBody.GetArrayLength());
            Assert.Equal(3, persistedByLanguage.Count);
            Assert.Equal("Hola", persistedByLanguage["es-es"]);
            Assert.Equal("Olá", persistedByLanguage["pt-br"]);
            Assert.Equal("Hello", persistedByLanguage["en-uk"]);

            var call = Assert.Single(_translationClient.Calls);
            Assert.Equal("es-es", call.SourceLanguageCode);
            Assert.Equal("Hola", call.SourceValue);
            Assert.Equal(new[] { "pt-br", "en-uk" }, call.TargetLanguageCodes);
        }

        [Fact]
        public async Task AutomaticTranslations_DbUpdateExceptionAfterRecheck_ReturnsConflict_AndPersistsOnlySource()
        {
            const string expectedCatchPathDetail = "Automatic translations could not be saved due to a concurrent update.";
            const string recheckConflictDetail = "Resource translations changed during automatic translation generation.";

            _translationClient.Result = new[]
            {
                new GeneratedTranslation("pt-br", "Olá"),
                new GeneratedTranslation("en-uk", "Hello")
            };

            _translationClient.BeforeReturnAsync = _ =>
            {
                _saveFailureSwitch.ArmOneFailure();
                return Task.CompletedTask;
            };

            var client = _factory.CreateClient();
            var session = await LoginAsync(client, "owner-auto-dbupdate", "owner-auto-dbupdate@example.com");
            var token = session.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });
            var responseBody = await response.Content.ReadFromJsonAsync<JsonElement>();

            var versionsResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Get,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/versions");
            var versions = await versionsResponse.Content.ReadFromJsonAsync<JsonElement>();
            var persisted = versions
                .EnumerateArray()
                .Select(x => new
                {
                    LanguageCode = x.GetProperty("languageCode").GetString(),
                    Value = x.GetProperty("value").GetString()
                })
                .ToArray();

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal(expectedCatchPathDetail, responseBody.GetProperty("detail").GetString());
            Assert.NotEqual(recheckConflictDetail, responseBody.GetProperty("detail").GetString());
            Assert.Collection(
                persisted,
                item =>
                {
                    Assert.Equal("es-es", item.LanguageCode);
                    Assert.Equal("Hola", item.Value);
                });
        }

        [Fact]
        public async Task AutomaticTranslations_Unauthenticated_ReturnsUnauthorized_AndDoesNotCallProvider()
        {
            var client = _factory.CreateClient();
            var owner = await LoginAsync(client, "owner-auto-unauth", "owner-auto-unauth@example.com");
            var ownerToken = owner.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, ownerToken, "Hola", "es-es");

            var response = await client.PostAsJsonAsync(
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
            Assert.Empty(_translationClient.Calls);
        }

        [Fact]
        public async Task AutomaticTranslations_Viewer_ReturnsForbidden_AndDoesNotCallProvider()
        {
            var client = _factory.CreateClient();
            var owner = await LoginAsync(client, "owner-auto-viewer", "owner-auto-viewer@example.com");
            var ownerToken = owner.GetProperty("accessToken").GetString()!;
            var viewer = await LoginAsync(client, "viewer-auto-viewer", "viewer-auto-viewer@example.com");
            var viewerToken = viewer.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, ownerToken, "Hola", "es-es");

            var share = await SendAuthorizedAsync(
                client,
                ownerToken,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/members",
                new { email = "viewer-auto-viewer@example.com", role = "viewer" });
            Assert.Equal(HttpStatusCode.Created, share.StatusCode);

            var response = await SendAuthorizedAsync(
                client,
                viewerToken,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Empty(_translationClient.Calls);
        }

        [Fact]
        public async Task AutomaticTranslations_InvalidHierarchy_ReturnsBadRequestOrNotFound_AndDoesNotCallProvider()
        {
            var client = _factory.CreateClient();
            var owner = await LoginAsync(client, "owner-auto-hierarchy", "owner-auto-hierarchy@example.com");
            var token = owner.GetProperty("accessToken").GetString()!;

            var first = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");
            var second = await CreateResourceHierarchyAsync(client, token, "Adiós", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{first.ProjectId}/pages/{first.PageId}/versions/{first.PageVersionId}/resources/{second.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound);
            Assert.Empty(_translationClient.Calls);
        }

        [Fact]
        public async Task AutomaticTranslations_MissingSource_ReturnsBadRequest_AndDoesNotCallProvider()
        {
            var client = _factory.CreateClient();
            var owner = await LoginAsync(client, "owner-auto-missing", "owner-auto-missing@example.com");
            var token = owner.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Olá", "pt-br");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Empty(_translationClient.Calls);
        }

        [Fact]
        public async Task AutomaticTranslations_UnsupportedSource_ReturnsBadRequest_AndDoesNotCallProvider()
        {
            var client = _factory.CreateClient();
            var owner = await LoginAsync(client, "owner-auto-unsupported", "owner-auto-unsupported@example.com");
            var token = owner.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "fr-fr" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Empty(_translationClient.Calls);
        }

        [Fact]
        public async Task AutomaticTranslations_NoPendingLanguages_ReturnsBadRequest_AndDoesNotCallProvider()
        {
            var client = _factory.CreateClient();
            var owner = await LoginAsync(client, "owner-auto-pending", "owner-auto-pending@example.com");
            var token = owner.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var versionsUrl = $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/versions";
            var addPortuguese = await SendAuthorizedAsync(client, token, HttpMethod.Post, versionsUrl, new { languageCode = "pt-br", value = "Olá" });
            var addEnglish = await SendAuthorizedAsync(client, token, HttpMethod.Post, versionsUrl, new { languageCode = "en-uk", value = "Hello" });
            Assert.Equal(HttpStatusCode.Created, addPortuguese.StatusCode);
            Assert.Equal(HttpStatusCode.Created, addEnglish.StatusCode);

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Empty(_translationClient.Calls);
        }

        [Theory]
        [InlineData("partial")]
        [InlineData("duplicate")]
        [InlineData("extra")]
        [InlineData("empty")]
        [InlineData("unsupported")]
        public async Task AutomaticTranslations_InvalidProviderSemanticOutput_ReturnsUnprocessableAndDoesNotInsert(string scenario)
        {
            _translationClient.Result = scenario switch
            {
                "partial" => new[]
                {
                    new GeneratedTranslation("pt-br", "Olá")
                },
                "duplicate" => new[]
                {
                    new GeneratedTranslation("pt-br", "Olá"),
                    new GeneratedTranslation("pt-br", "Hello")
                },
                "extra" => new[]
                {
                    new GeneratedTranslation("pt-br", "Olá"),
                    new GeneratedTranslation("en-uk", "Hello"),
                    new GeneratedTranslation("es-es", "Hola")
                },
                "empty" => new[]
                {
                    new GeneratedTranslation("pt-br", " "),
                    new GeneratedTranslation("en-uk", "Hello")
                },
                "unsupported" => new[]
                {
                    new GeneratedTranslation("pt-br", "Olá"),
                    new GeneratedTranslation("fr-fr", "Bonjour")
                },
                _ => Array.Empty<GeneratedTranslation>()
            };

            var client = _factory.CreateClient();
            var session = await LoginAsync(client, $"owner-auto-invalid-{scenario}", $"owner-auto-invalid-{scenario}@example.com");
            var token = session.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            var versionsResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Get,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/versions");
            var versions = await versionsResponse.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal((HttpStatusCode)422, response.StatusCode);
            Assert.Equal(1, versions.GetArrayLength());
        }

        [Fact]
        public async Task AutomaticTranslations_ProviderInvalidResponse_MapsToBadGateway_AndDoesNotLeakSensitiveDetails()
        {
            _translationClient.Failure = new AutomaticTranslationProviderException(
                TranslationProviderFailure.InvalidResponse,
                "provider-invalid");

            var client = _factory.CreateClient();
            var session = await LoginAsync(client, "owner-auto-502", "owner-auto-502@example.com");
            var token = session.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.BadGateway, response.StatusCode);
            Assert.DoesNotContain("api key", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("openai", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("responses", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("hola", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task AutomaticTranslations_ProviderUnavailable_MapsToServiceUnavailable_AndDoesNotLeakSensitiveDetails()
        {
            _translationClient.Failure = new AutomaticTranslationProviderException(
                TranslationProviderFailure.Unavailable,
                "provider-unavailable");

            var client = _factory.CreateClient();
            var session = await LoginAsync(client, "owner-auto-503", "owner-auto-503@example.com");
            var token = session.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });
            var body = await response.Content.ReadFromJsonAsync<JsonElement>();

            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.DoesNotContain("api key", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("openai", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("responses", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("hola", body.GetProperty("detail").GetString()!, StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task AutomaticTranslations_ConcurrentInsertionBetweenProviderAndSave_ReturnsConflict_AndIsAllOrNothing()
        {
            _translationClient.Result = new[]
            {
                new GeneratedTranslation("pt-br", "Olá"),
                new GeneratedTranslation("en-uk", "Hello")
            };

            var client = _factory.CreateClient();
            var session = await LoginAsync(client, "owner-auto-concurrent", "owner-auto-concurrent@example.com");
            var token = session.GetProperty("accessToken").GetString()!;
            var hierarchy = await CreateResourceHierarchyAsync(client, token, "Hola", "es-es");

            _translationClient.BeforeReturnAsync = async _ =>
            {
                var options = new DbContextOptionsBuilder<AppDbContext>()
                    .UseSqlite($"Data Source={_dbPath}")
                    .Options;
                await using var context = new AppDbContext(options);
                var now = DateTime.UtcNow;
                context.ResourceVersions.Add(new ResourceVersion
                {
                    Id = Guid.NewGuid(),
                    ResourceId = Guid.Parse(hierarchy.ResourceId),
                    LanguageCode = "pt-br",
                    Value = "Inserción concurrente",
                    CreatedAt = now,
                    UpdatedAt = now,
                    IsDeleted = false
                });
                await context.SaveChangesAsync();
            };

            var response = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/automatic-translations",
                new { sourceLanguageCode = "es-es" });

            var versionsResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Get,
                $"/api/v1/projects/{hierarchy.ProjectId}/pages/{hierarchy.PageId}/versions/{hierarchy.PageVersionId}/resources/{hierarchy.ResourceId}/versions");
            var versions = await versionsResponse.Content.ReadFromJsonAsync<JsonElement>();
            var languages = versions
                .EnumerateArray()
                .Select(x => x.GetProperty("languageCode").GetString())
                .Where(x => x is not null)
                .ToArray();

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Contains("es-es", languages);
            Assert.Contains("pt-br", languages);
            Assert.DoesNotContain("en-uk", languages);
            Assert.Equal(2, languages.Length);
        }

        private static async Task<(string ProjectId, string PageId, string PageVersionId, string ResourceId)> CreateResourceHierarchyAsync(
            HttpClient client,
            string token,
            string sourceValue,
            string sourceLanguageCode)
        {
            var projectResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                "/api/v1/projects",
                new { name = $"Project-{Guid.NewGuid():N}" });
            projectResponse.EnsureSuccessStatusCode();
            var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

            var pageResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{projectId}/pages",
                new { name = "Home" });
            pageResponse.EnsureSuccessStatusCode();
            var pageId = (await pageResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

            var pageVersionResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{projectId}/pages/{pageId}/versions",
                new { name = "v1" });
            pageVersionResponse.EnsureSuccessStatusCode();
            var pageVersionId = (await pageVersionResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

            var resourceResponse = await SendAuthorizedAsync(
                client,
                token,
                HttpMethod.Post,
                $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources",
                new { key = "hero.title", languageCode = sourceLanguageCode, value = sourceValue });
            resourceResponse.EnsureSuccessStatusCode();
            var resourceId = (await resourceResponse.Content.ReadFromJsonAsync<JsonElement>())
                .GetProperty("resource")
                .GetProperty("id")
                .GetString()!;

            return (projectId, pageId, pageVersionId, resourceId);
        }

        private sealed class FakeAutomaticTranslationClient : IAutomaticTranslationClient
        {
            public List<AutomaticTranslationInput> Calls { get; } = [];

            public IReadOnlyList<GeneratedTranslation> Result { get; set; } = [];

            public AutomaticTranslationProviderException? Failure { get; set; }

            public Func<AutomaticTranslationInput, Task>? BeforeReturnAsync { get; set; }

            public async Task<IReadOnlyList<GeneratedTranslation>> GenerateAsync(
                AutomaticTranslationInput input,
                CancellationToken cancellationToken)
            {
                Calls.Add(input);

                if (Failure is not null)
                {
                    throw Failure;
                }

                if (BeforeReturnAsync is not null)
                {
                    await BeforeReturnAsync(input);
                }

                return Result;
            }
        }

        private sealed class AutomaticTranslationSaveFailureSwitch
        {
            private int _remainingFailures;

            public void ArmOneFailure()
            {
                Interlocked.Exchange(ref _remainingFailures, 1);
            }

            public bool TryConsumeFailure()
            {
                return Interlocked.CompareExchange(ref _remainingFailures, 0, 1) == 1;
            }
        }

        private sealed class ThrowOnNextAutomaticTranslationSaveInterceptor : SaveChangesInterceptor
        {
            private readonly AutomaticTranslationSaveFailureSwitch _failureSwitch;

            public ThrowOnNextAutomaticTranslationSaveInterceptor(AutomaticTranslationSaveFailureSwitch failureSwitch)
            {
                _failureSwitch = failureSwitch;
            }

            public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
            {
                ThrowWhenArmed(eventData.Context);
                return base.SavingChanges(eventData, result);
            }

            public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
                DbContextEventData eventData,
                InterceptionResult<int> result,
                CancellationToken cancellationToken = default)
            {
                ThrowWhenArmed(eventData.Context);
                return base.SavingChangesAsync(eventData, result, cancellationToken);
            }

            private void ThrowWhenArmed(DbContext? dbContext)
            {
                if (dbContext is null)
                {
                    return;
                }

                var hasAddedResourceVersions = dbContext.ChangeTracker
                    .Entries<ResourceVersion>()
                    .Any(x => x.State == EntityState.Added);

                if (hasAddedResourceVersions && _failureSwitch.TryConsumeFailure())
                {
                    throw new DbUpdateException("Simulated DbUpdateException for automatic translations.", innerException: null);
                }
            }
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
