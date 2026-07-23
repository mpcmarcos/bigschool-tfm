# Feature Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar la gestión jerárquica base (Page, PageVersion, Resource, ResourceVersion, ResourcePage) con navegación completa frontend y contrato REST backend dentro del contexto de proyecto.

**Architecture:** Se extiende el patrón existente de Projects en backend (.NET 8 + EF Core) y frontend (React + App.tsx + api.ts) para añadir CRUD jerárquico y validaciones de árbol por IDs de ruta. El backend encapsula reglas de acceso y consistencia en un nuevo servicio de dominio, y el frontend mantiene el sistema visual de modales/acciones ya usado en Projects. Todo se ejecuta en TDD (Red -> Green -> Refactor) por bloques independientes.

**Tech Stack:** .NET 8, ASP.NET Core, EntityFrameworkCore 8 (Sqlite/MySql), xUnit, React 19, TypeScript, Vitest, Testing Library.

## Global Constraints

- La UI mantiene consistencia visual y de interacción con el patrón usado en Projects (acciones, modales, confirmaciones).
- El borrado es lógico (`isDeleted=true`) y los listados omiten borrados por defecto.
- Debe existir una única `PageVersion` por defecto por cada `Page`.
- Debe existir una única `ResourceVersion` por defecto por cada `Resource`.
- Los IDs de ruta deben pertenecer al mismo árbol jerárquico; si hay inconsistencia se rechaza la operación.
- Solo miembros del proyecto (owner/editor/viewer según permiso) pueden consultar la jerarquía.
- La implementación debe ejecutarse con ciclo **Red -> Green -> Refactor** en cada bloque funcional.
- Regla de salida: no se considera completada la feature hasta que la suite de tests relevante quede en verde tras los cambios.

---

## File Structure Map

- **Backend domain models**
  - Create `src/resources-api/Models/Page.cs`
  - Create `src/resources-api/Models/PageVersion.cs`
  - Create `src/resources-api/Models/Resource.cs`
  - Create `src/resources-api/Models/ResourceVersion.cs`
  - Create `src/resources-api/Models/ResourcePage.cs`
- **Backend contracts**
  - Create `src/resources-api/Contracts/CreatePageRequest.cs`
  - Create `src/resources-api/Contracts/UpdatePageRequest.cs`
  - Create `src/resources-api/Contracts/PageResponse.cs`
  - Create `src/resources-api/Contracts/CreatePageVersionRequest.cs`
  - Create `src/resources-api/Contracts/UpdatePageVersionRequest.cs`
  - Create `src/resources-api/Contracts/PageVersionResponse.cs`
  - Create `src/resources-api/Contracts/CreateResourceRequest.cs`
  - Create `src/resources-api/Contracts/UpdateResourceRequest.cs`
  - Create `src/resources-api/Contracts/ResourceResponse.cs`
  - Create `src/resources-api/Contracts/CreateResourceVersionRequest.cs`
  - Create `src/resources-api/Contracts/UpdateResourceVersionRequest.cs`
  - Create `src/resources-api/Contracts/ResourceVersionResponse.cs`
  - Create `src/resources-api/Contracts/CreateResourcePageRequest.cs`
  - Create `src/resources-api/Contracts/UpdateResourcePageRequest.cs`
  - Create `src/resources-api/Contracts/ResourcePageResponse.cs`
- **Backend services/controllers/persistence**
  - Create `src/resources-api/Services/NavigationService.cs`
  - Create `src/resources-api/Services/NavigationException.cs`
  - Create `src/resources-api/Controllers/NavigationController.cs`
  - Modify `src/resources-api/Data/AppDbContext.cs`
  - Modify `src/resources-api/Models/Project.cs`
  - Modify `src/resources-api/Models/User.cs`
  - Modify `src/resources-api/Program.cs`
  - Create `src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.cs`
  - Create `src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.Designer.cs`
- **Frontend client and screen**
  - Modify `src/resources-app/src/api.ts`
  - Modify `src/resources-app/src/App.tsx`
  - Modify `src/resources-app/src/App.css`
- **Tests**
  - Modify `src/resources-api-test/ApiIntegrationTests.cs`
  - Modify `src/resources-app-test/App.integration.test.tsx`

---

### Task 1: Red tests for hierarchical backend contract

**Files:**
- Modify: `src/resources-api-test/ApiIntegrationTests.cs`
- Test: `src/resources-api-test/ApiIntegrationTests.cs`

**Interfaces:**
- Consumes: existing auth helper `LoginAsync(HttpClient client, string providerUserId, string email)`.
- Produces:
  - `Navigation_Flow_CreatePagePageVersionResourceResourceVersionResourcePage_WorksAsExpected()`
  - `Navigation_Defaults_AreUniquePerParent()`
  - `Navigation_InvalidHierarchy_ReturnsBadRequestOrNotFound()`
  - `Navigation_NonMemberAccess_ReturnsForbidden()`

- [ ] **Step 1: Write the failing test**

```csharp
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

    var createPage = await SendAuthorizedAsync(client, ownerToken, HttpMethod.Post, $"/api/v1/projects/{projectId}/pages", new
    {
        name = "Home",
        description = "Página inicial"
    });
    Assert.Equal(HttpStatusCode.Created, createPage.StatusCode);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_Flow_CreatePagePageVersionResourceResourceVersionResourcePage_WorksAsExpected"`

Expected: FAIL (404/405 o contrato inexistente en `/api/v1/projects/{projectId}/pages`).

- [ ] **Step 3: Expand failing suite for defaults, access and hierarchy consistency**

```csharp
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

    Assert.Equal(HttpStatusCode.Forbidden, outsiderPagesResponse.StatusCode);
}
```

- [ ] **Step 4: Run test suite to confirm red state**

Run: `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_"`

Expected: FAIL en las nuevas pruebas.

- [ ] **Step 5: Commit**

```bash
git add src/resources-api-test/ApiIntegrationTests.cs
git commit -m "test: add failing integration tests for navigation hierarchy"
```

---

### Task 2: EF Core schema and domain models

**Files:**
- Create: `src/resources-api/Models/Page.cs`
- Create: `src/resources-api/Models/PageVersion.cs`
- Create: `src/resources-api/Models/Resource.cs`
- Create: `src/resources-api/Models/ResourceVersion.cs`
- Create: `src/resources-api/Models/ResourcePage.cs`
- Modify: `src/resources-api/Models/Project.cs`
- Modify: `src/resources-api/Models/User.cs`
- Modify: `src/resources-api/Data/AppDbContext.cs`
- Create: `src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.cs`
- Create: `src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.Designer.cs`
- Test: `src/resources-api-test/ApiIntegrationTests.cs`

**Interfaces:**
- Consumes: `Project.Id`, `ProjectMember` access model, `AppDbContext`.
- Produces:
  - `DbSet<Page> Pages`
  - `DbSet<PageVersion> PageVersions`
  - `DbSet<Resource> Resources`
  - `DbSet<ResourceVersion> ResourceVersions`
  - `DbSet<ResourcePage> ResourcePages`

- [ ] **Step 1: Implement model classes**

```csharp
namespace resources_api.Models
{
    public class Page
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public required string Name { get; set; }
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }
        public Project Project { get; set; } = null!;
        public ICollection<PageVersion> Versions { get; set; } = new List<PageVersion>();
    }
}
```

- [ ] **Step 2: Wire DbSets and Fluent API**

```csharp
public DbSet<Page> Pages => Set<Page>();
public DbSet<PageVersion> PageVersions => Set<PageVersion>();
public DbSet<Resource> Resources => Set<Resource>();
public DbSet<ResourceVersion> ResourceVersions => Set<ResourceVersion>();
public DbSet<ResourcePage> ResourcePages => Set<ResourcePage>();

modelBuilder.Entity<Page>(entity =>
{
    entity.HasKey(x => x.Id);
    entity.Property(x => x.Name).IsRequired().HasMaxLength(200);
    entity.Property(x => x.Description).HasMaxLength(2000);
    entity.Property(x => x.IsDeleted).IsRequired();
    entity.HasIndex(x => new { x.ProjectId, x.IsDeleted });
});
```

- [ ] **Step 3: Add uniqueness constraints for defaults**

```csharp
modelBuilder.Entity<PageVersion>()
    .HasIndex(x => new { x.PageId, x.IsDefault })
    .HasFilter("\"IsDefault\" = 1 AND \"IsDeleted\" = 0")
    .IsUnique();

modelBuilder.Entity<ResourceVersion>()
    .HasIndex(x => new { x.ResourceId, x.IsDefault })
    .HasFilter("\"IsDefault\" = 1 AND \"IsDeleted\" = 0")
    .IsUnique();
```

- [ ] **Step 4: Create migration files and run tests**

Run:
- `dotnet build src/resources-api/resources-api.csproj`
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_"`

Expected: tests siguen FAIL (falta servicio/controlador), build PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resources-api/Models src/resources-api/Data/AppDbContext.cs src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.cs src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.Designer.cs
git commit -m "feat: add EF hierarchy schema for navigation domain"
```

---

### Task 3: Contracts and navigation service business rules

**Files:**
- Create: `src/resources-api/Contracts/CreatePageRequest.cs`
- Create: `src/resources-api/Contracts/UpdatePageRequest.cs`
- Create: `src/resources-api/Contracts/PageResponse.cs`
- Create: `src/resources-api/Contracts/CreatePageVersionRequest.cs`
- Create: `src/resources-api/Contracts/UpdatePageVersionRequest.cs`
- Create: `src/resources-api/Contracts/PageVersionResponse.cs`
- Create: `src/resources-api/Contracts/CreateResourceRequest.cs`
- Create: `src/resources-api/Contracts/UpdateResourceRequest.cs`
- Create: `src/resources-api/Contracts/ResourceResponse.cs`
- Create: `src/resources-api/Contracts/CreateResourceVersionRequest.cs`
- Create: `src/resources-api/Contracts/UpdateResourceVersionRequest.cs`
- Create: `src/resources-api/Contracts/ResourceVersionResponse.cs`
- Create: `src/resources-api/Contracts/CreateResourcePageRequest.cs`
- Create: `src/resources-api/Contracts/UpdateResourcePageRequest.cs`
- Create: `src/resources-api/Contracts/ResourcePageResponse.cs`
- Create: `src/resources-api/Services/NavigationException.cs`
- Create: `src/resources-api/Services/NavigationService.cs`
- Test: `src/resources-api-test/ApiIntegrationTests.cs`

**Interfaces:**
- Consumes: `AppDbContext`, `ProjectMember` authorization rules from `ProjectService`.
- Produces:
  - `Task<PageResponse> CreatePageAsync(Guid userId, Guid projectId, CreatePageRequest request, CancellationToken ct)`
  - `Task<PageVersionResponse> SetDefaultPageVersionAsync(Guid userId, Guid projectId, Guid pageId, Guid pageVersionId, CancellationToken ct)`
  - `Task<ResourceVersionResponse> SetDefaultResourceVersionAsync(Guid userId, Guid projectId, Guid resourceId, Guid resourceVersionId, CancellationToken ct)`
  - `Task<ResourcePageResponse> CreateResourcePageAsync(Guid userId, Guid projectId, Guid pageId, Guid pageVersionId, CreateResourcePageRequest request, CancellationToken ct)`

- [ ] **Step 1: Add request/response contracts**

```csharp
public class CreatePageRequest
{
    [Required]
    [MaxLength(200)]
    public string? Name { get; set; }

    [MaxLength(2000)]
    public string? Description { get; set; }
}

public class PageResponse
{
    public required string Id { get; set; }
    public required string ProjectId { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required DateTime UpdatedAt { get; set; }
    public required bool IsDeleted { get; set; }
}
```

- [ ] **Step 2: Create service skeleton and access validation**

```csharp
public class NavigationService
{
    private readonly AppDbContext _dbContext;

    public NavigationService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private async Task<Project> RequireProjectAccessAsync(Guid userId, Guid projectId, bool requiresManagePermission, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .Include(x => x.Members)
            .FirstOrDefaultAsync(x => x.Id == projectId && !x.IsDeleted, cancellationToken);
        if (project == null) throw new NavigationException(HttpStatusCode.NotFound, "Project not found.");
        if (project.OwnerUserId == userId) return project;
        var membership = project.Members.FirstOrDefault(x => x.UserId == userId && !x.IsDeleted);
        if (membership == null) throw new NavigationException(HttpStatusCode.Forbidden, "You do not have access to this project.");
        if (requiresManagePermission && membership.Role is not ("admin" or "editor"))
            throw new NavigationException(HttpStatusCode.Forbidden, "You do not have permission to modify this project.");
        return project;
    }
}
```

- [ ] **Step 3: Implement defaults and hierarchy consistency methods**

```csharp
private static void EnsurePageHierarchy(Page page, Guid projectId)
{
    if (page.ProjectId != projectId)
    {
        throw new NavigationException(HttpStatusCode.BadRequest, "Page does not belong to project.");
    }
}

private async Task SetPageVersionDefaultAsync(Guid pageId, Guid pageVersionId, CancellationToken cancellationToken)
{
    var currentDefaults = await _dbContext.PageVersions
        .Where(x => x.PageId == pageId && x.IsDefault && !x.IsDeleted && x.Id != pageVersionId)
        .ToListAsync(cancellationToken);
    foreach (var version in currentDefaults) version.IsDefault = false;
}
```

- [ ] **Step 4: Run focused tests**

Run: `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_"`

Expected: FAIL parcial (todavía faltan endpoints), pero lógica compila.

- [ ] **Step 5: Commit**

```bash
git add src/resources-api/Contracts src/resources-api/Services/NavigationService.cs src/resources-api/Services/NavigationException.cs
git commit -m "feat: add navigation contracts and domain service rules"
```

---

### Task 4: Navigation controller and API route wiring

**Files:**
- Create: `src/resources-api/Controllers/NavigationController.cs`
- Modify: `src/resources-api/Program.cs`
- Test: `src/resources-api-test/ApiIntegrationTests.cs`

**Interfaces:**
- Consumes: `NavigationService` methods from Task 3.
- Produces REST endpoints:
  - `GET/POST/PUT/DELETE /api/v1/projects/{projectId}/pages`
  - `GET/POST/PUT/DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions`
  - `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/set-default`
  - `GET/POST/PUT/DELETE /api/v1/projects/{projectId}/resources`
  - `GET/POST/PUT/DELETE /api/v1/projects/{projectId}/resources/{resourceId}/versions`
  - `POST /api/v1/projects/{projectId}/resources/{resourceId}/versions/{resourceVersionId}/set-default`
  - `GET/POST/PUT/DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resource-pages`

- [ ] **Step 1: Add controller with auth user resolution**

```csharp
[Route("api/v1/projects/{projectId:guid}")]
[ApiController]
[Authorize]
public class NavigationController : ControllerBase
{
    private readonly NavigationService _navigationService;
    public NavigationController(NavigationService navigationService) => _navigationService = navigationService;

    [HttpPost("pages")]
    public async Task<ActionResult<PageResponse>> CreatePage(Guid projectId, [FromBody] CreatePageRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
            return Problem(statusCode: StatusCodes.Status401Unauthorized, detail: "User is not authenticated.");
        var created = await _navigationService.CreatePageAsync(userId, projectId, request, cancellationToken);
        return Created($"/api/v1/projects/{projectId}/pages/{created.Id}", created);
    }
}
```

- [ ] **Step 2: Add exception mapping and full endpoint surface**

```csharp
private ActionResult BuildProblem(NavigationException exception)
{
    var statusCode = (int)exception.StatusCode;
    return Problem(statusCode: statusCode, detail: exception.Message);
}
```

- [ ] **Step 3: Register service in DI**

```csharp
builder.Services.AddScoped<NavigationService>();
```

- [ ] **Step 4: Run backend navigation tests**

Run:
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_"`
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Projects_"`

Expected: PASS en `Navigation_` y sin regresiones en `Projects_`.

- [ ] **Step 5: Commit**

```bash
git add src/resources-api/Controllers/NavigationController.cs src/resources-api/Program.cs src/resources-api-test/ApiIntegrationTests.cs
git commit -m "feat: expose navigation hierarchy REST endpoints"
```

---

### Task 5: Frontend API client for hierarchy endpoints

**Files:**
- Modify: `src/resources-app/src/api.ts`
- Test: `src/resources-app-test/App.integration.test.tsx`

**Interfaces:**
- Consumes: `buildAuthHeaders(accessToken: string)`, `parseResponse<T>(response: Response)`.
- Produces:
  - `getPages(accessToken: string, projectId: string): Promise<PageResponse[]>`
  - `postPage(accessToken: string, projectId: string, payload: { name: string; description: string }): Promise<PageResponse>`
  - `getPageVersions(...)`, `setDefaultPageVersion(...)`
  - `getResources(...)`, `getResourceVersions(...)`, `setDefaultResourceVersion(...)`
  - `getResourcePages(...)`, `postResourcePage(...)`

- [ ] **Step 1: Add types**

```ts
export type PageResponse = {
  id: string
  projectId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type PageVersionResponse = {
  id: string
  pageId: string
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}
```

- [ ] **Step 2: Add API functions**

```ts
export const getPages = async (accessToken: string, projectId: string): Promise<PageResponse[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/pages`, {
    headers: buildAuthHeaders(accessToken),
  })
  return parseResponse<PageResponse[]>(response)
}

export const postPage = async (
  accessToken: string,
  projectId: string,
  payload: { name: string; description: string },
): Promise<PageResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/pages`, {
    method: 'POST',
    headers: buildAuthHeaders(accessToken),
    body: JSON.stringify(payload),
  })
  return parseResponse<PageResponse>(response)
}
```

- [ ] **Step 3: Add default-version actions**

```ts
export const setDefaultPageVersion = async (
  accessToken: string,
  projectId: string,
  pageId: string,
  pageVersionId: string,
): Promise<PageVersionResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/projects/${projectId}/pages/${pageId}/versions/${pageVersionId}/set-default`,
    { method: 'POST', headers: buildAuthHeaders(accessToken) },
  )
  return parseResponse<PageVersionResponse>(response)
}
```

- [ ] **Step 4: Run frontend tests in red/partial-green state**

Run: `(cd src/resources-app-test && npm test -- --runInBand App.integration.test.tsx)`

Expected: FAIL (App.tsx aún no consume los nuevos métodos).

- [ ] **Step 5: Commit**

```bash
git add src/resources-app/src/api.ts
git commit -m "feat: add frontend navigation hierarchy api client"
```

---

### Task 6: Frontend hierarchical navigation UI using Projects visual system

**Files:**
- Modify: `src/resources-app/src/App.tsx`
- Modify: `src/resources-app/src/App.css`
- Test: `src/resources-app-test/App.integration.test.tsx`

**Interfaces:**
- Consumes:
  - `getPages`, `postPage`, `getPageVersions`, `setDefaultPageVersion`, `getResourcePages`, `postResourcePage`
  - existing `navigate(path: string)` and route parsing flow.
- Produces:
  - UI states: `pages`, `pageVersions`, `resources`, `resourceVersions`, `resourcePages`
  - handlers: `loadProjectPages`, `loadPageVersions`, `loadResourceVersions`, `handleCreatePage`, `handleSetDefaultPageVersion`

- [ ] **Step 1: Extend route resolver for 6 levels**

```ts
type RouteInfo = {
  view: 'home' | 'login' | 'projects'
  projectId: string | null
  pageId: string | null
  pageVersionId: string | null
  resourceId: string | null
  resourcePageId: string | null
}

const resolveRoute = (path: string): RouteInfo => {
  const pathSegments = path.split('/').filter(Boolean)
  if (path === '/login') return { view: 'login', projectId: null, pageId: null, pageVersionId: null, resourceId: null, resourcePageId: null }
  if (path === '/') return { view: 'home', projectId: null, pageId: null, pageVersionId: null, resourceId: null, resourcePageId: null }
  return {
    view: 'projects',
    projectId: pathSegments[1] ?? null,
    pageId: pathSegments[2] ?? null,
    pageVersionId: pathSegments[3] ?? null,
    resourceId: pathSegments[4] ?? null,
    resourcePageId: pathSegments[5] ?? null,
  }
}
```

- [ ] **Step 2: Add state and loader handlers per hierarchy**

```ts
const [pages, setPages] = useState<PageResponse[]>([])
const [pageVersions, setPageVersions] = useState<PageVersionResponse[]>([])

const loadProjectPages = async (projectId: string) => {
  if (!session) return
  const items = await getPages(session.accessToken, projectId)
  setPages(items.filter((item) => !item.isDeleted))
}
```

- [ ] **Step 3: Render contextual panels with existing modal pattern**

```tsx
{route.projectId && !route.pageId ? (
  <section className="panel-card neon-border">
    <div className="projects-header">
      <h1>Páginas del proyecto</h1>
      <button type="button" onClick={() => setIsCreatePageModalOpen(true)}>Crear página</button>
    </div>
    <ul className="projects-list">
      {pages.map((page) => (
        <li key={page.id} className="project-card">
          <h2>{page.name}</h2>
          <div className="project-actions">
            <button type="button" onClick={() => navigate(`/projects/${route.projectId}/${page.id}`)}>Ver versiones</button>
          </div>
        </li>
      ))}
    </ul>
  </section>
) : null}
```

- [ ] **Step 4: Update styles for hierarchy sections**

Run: `(cd src/resources-app && npm run build)`

Expected: build PASS, sin errores TS.

- [ ] **Step 5: Commit**

```bash
git add src/resources-app/src/App.tsx src/resources-app/src/App.css
git commit -m "feat: implement hierarchical navigation ui for projects flow"
```

---

### Task 7: Frontend integration tests for hierarchical flow

**Files:**
- Modify: `src/resources-app-test/App.integration.test.tsx`
- Test: `src/resources-app-test/App.integration.test.tsx`

**Interfaces:**
- Consumes: existing mocked `fetch` style in `creates, edits, shares and soft deletes a project`.
- Produces tests:
  - `navigates from project to page versions and resource levels`
  - `sets default versions and reflects state in UI`
  - `blocks inconsistent hierarchy responses with visible error`

- [ ] **Step 1: Add failing integration test for navigation levels**

```ts
it('navigates across hierarchy levels from project to resource detail', async () => {
  window.history.pushState({}, '', '/projects/project-1')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Páginas del proyecto' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver versiones' }))
  expect(await screen.findByRole('heading', { name: 'Versiones de página' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run targeted test to confirm red**

Run: `(cd src/resources-app-test && npm test -- --runInBand -t "navigates across hierarchy levels from project to resource detail")`

Expected: FAIL.

- [ ] **Step 3: Add tests for default version actions and hierarchy error**

```ts
it('marks selected page version as default', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (typeof input !== 'string') throw new Error('Unexpected request')
    if (input.includes('/set-default') && init?.method === 'POST') {
      return buildJsonResponse({
        id: 'page-version-2',
        pageId: 'page-1',
        name: 'v2',
        isDefault: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        isDeleted: false,
      })
    }
    if (input.includes('/versions') && (init?.method ?? 'GET') === 'GET') {
      return buildJsonResponse([
        { id: 'page-version-1', pageId: 'page-1', name: 'v1', isDefault: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', isDeleted: false },
        { id: 'page-version-2', pageId: 'page-1', name: 'v2', isDefault: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', isDeleted: false },
      ])
    }
    return buildJsonResponse([])
  })

  render(<App />)
  expect(await screen.findByText(/v2/i)).toBeInTheDocument()
  expect(screen.getByText(/default/i)).toBeInTheDocument()
})

it('shows hierarchy error message when backend rejects inconsistent ids', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    if (typeof input !== 'string') throw new Error('Unexpected request')
    if (input.includes('/resource-pages') && init?.method === 'POST') {
      return buildJsonResponse({ detail: 'Page version does not belong to project.' }, 400)
    }
    return buildJsonResponse([])
  })

  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Guardar relación' }))
  expect(await screen.findByText('Page version does not belong to project.')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run full frontend integration suite**

Run: `(cd src/resources-app-test && npm test)`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resources-app-test/App.integration.test.tsx
git commit -m "test: cover hierarchical navigation frontend flows"
```

---

### Task 8: Final verification and documentation synchronization

**Files:**
- Modify: `docs/04-feature-navigation/SPEC.md` (solo si hay ajuste real derivado de implementación)
- Test: `src/resources-api-test/ApiIntegrationTests.cs`
- Test: `src/resources-app-test/App.integration.test.tsx`

**Interfaces:**
- Consumes: all tasks completed.
- Produces: verified feature + optional spec sync diff.

- [ ] **Step 1: Run backend tests**

Run: `dotnet test src/resources-api-test/resources-api-test.csproj`

Expected: PASS.

- [ ] **Step 2: Run frontend tests**

Run: `(cd src/resources-app-test && npm test)`

Expected: PASS.

- [ ] **Step 3: Run frontend type/build and lint**

Run:
- `(cd src/resources-app && npm run build)`
- `(cd src/resources-app && npm run lint)`

Expected: PASS.

- [ ] **Step 4: Ensure spec consistency**

```markdown
Verificar que endpoints finales, nombres de entidades y reglas de default coinciden con:
- docs/04-feature-navigation/SPEC.md
```

- [ ] **Step 5: Commit**

```bash
git add src/resources-api src/resources-api-test src/resources-app src/resources-app-test docs/04-feature-navigation/SPEC.md
git commit -m "feat: deliver hierarchical base navigation end-to-end"
```

---

## Self-Review Checklist

### 1) Spec coverage

- Objetivo y entidades (`Page`, `PageVersion`, `Resource`, `ResourceVersion`, `ResourcePage`) cubiertos en Tasks 2-7.
- Alcance frontend (6 niveles de navegación) cubierto en Tasks 6-7.
- Contrato backend REST por nivel cubierto en Tasks 3-4.
- Reglas de negocio (acceso, soft delete, defaults únicos, consistencia jerárquica) cubiertas en Tasks 2-4 y validadas en Task 1.
- Cambios EF (DbSet, relaciones, índices, migraciones) cubiertos en Task 2.
- Estrategia TDD aplicada explícitamente en todas las tareas.

### 2) Placeholder scan

- No se usan TBD/TODO/fill later.
- Todos los pasos incluyen comando/fragmento concreto.
- Cada tarea cierra con commit explícito.

### 3) Type consistency

- Convención `*Response` y `*Request` consistente con el patrón actual de `Project`.
- Servicios exponen métodos `Async` con `(Guid userId, ... , CancellationToken ct)`.
- Frontend client usa `parseResponse<T>` y `buildAuthHeaders(accessToken)` igual que APIs existentes.
