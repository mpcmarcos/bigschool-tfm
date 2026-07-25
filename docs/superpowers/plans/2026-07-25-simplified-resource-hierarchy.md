# Simplified Resource Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ResourcePage` with a direct `PageVersion → Resource` relationship and represent each resource translation as one language-coded `ResourceVersion` across backend and frontend.

**Architecture:** `Resource` receives a required `PageVersionId`; nested API routes validate the complete project/page/page-version/resource tree. `ResourceVersion` stores `LanguageCode` and `Value`, with one active row per resource and language. React follows the same four-ID route and uses a local, extensible language catalog with downloaded SVG flags.

**Tech Stack:** ASP.NET Core 8, EF Core 8, Pomelo MySQL, xUnit, React 19, TypeScript, Vite 8, Vitest, Testing Library.

## Global Constraints

- Remove `ResourcePage` from models, contracts, persistence, API, frontend state, routes and tests.
- Every `Resource` belongs to exactly one `PageVersion` through required `PageVersionId`.
- `ResourceVersion.LanguageCode` replaces `Name`; remove `IsDefault` and resource-version `set-default` behavior.
- Initial supported codes are exactly `pt-br`, `es-es` and `en-uk`, normalized to lowercase.
- `(ResourceId, LanguageCode)` must be unique for active resource versions.
- The catalog is extensible and must not impose a database-level maximum of three languages.
- Flags are local SVG assets downloaded from the MIT-licensed `lipis/flag-icons` project.
- The development database may be destroyed and recreated; preserving old navigation data is out of scope.
- Do not create commits unless the user explicitly requests them.

---

### Task 1: Direct PageVersion Resource Model and Atomic Creation

**Files:**
- Modify: `src/resources-api-test/ApiIntegrationTests.cs`
- Modify: `src/resources-api/Models/Project.cs`
- Modify: `src/resources-api/Models/PageVersion.cs`
- Modify: `src/resources-api/Models/Resource.cs`
- Modify: `src/resources-api/Models/ResourceVersion.cs`
- Delete: `src/resources-api/Models/ResourcePage.cs`
- Modify: `src/resources-api/Data/AppDbContext.cs`
- Modify: `src/resources-api/Contracts/CreateResourceRequest.cs`
- Modify: `src/resources-api/Contracts/ResourceResponse.cs`
- Delete: `src/resources-api/Contracts/CreateResourcePageRequest.cs`
- Delete: `src/resources-api/Contracts/UpdateResourcePageRequest.cs`
- Delete: `src/resources-api/Contracts/ResourcePageResponse.cs`
- Modify: `src/resources-api/Services/NavigationService.cs`
- Modify: `src/resources-api/Controllers/NavigationController.cs`

**Interfaces:**
- Produces: `Resource.PageVersionId`, `PageVersion.Resources`, and `ResourceResponse.PageVersionId`.
- Produces: `CreateResourceAsync(Guid userId, Guid projectId, Guid pageId, Guid pageVersionId, CreateResourceRequest request, CancellationToken cancellationToken)`.
- Produces: nested `GET|POST|PUT|DELETE /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources` routes.
- Consumes: existing project-membership and page-version hierarchy checks in `NavigationService`.

- [ ] **Step 1: Replace the old flow test with a failing direct-resource test**

Rewrite `Navigation_Flow_CreatePagePageVersionResourceResourceVersionResourcePage_WorksAsExpected` as `Navigation_Flow_CreatesResourceDirectlyInsidePageVersion`.

The test must:

```csharp
var response = await SendAuthorizedAsync(
    client,
    ownerToken,
    HttpMethod.Post,
    $"/api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources",
    new { key = "home.title", description = "Title", languageCode = "es-es", value = "Inicio" });

Assert.Equal(HttpStatusCode.Created, response.StatusCode);
var body = await response.Content.ReadFromJsonAsync<JsonElement>();
Assert.Equal(pageVersionId, body.GetProperty("resource").GetProperty("pageVersionId").GetString());
Assert.Equal("es-es", body.GetProperty("resourceVersion").GetProperty("languageCode").GetString());
Assert.Equal("Inicio", body.GetProperty("resourceVersion").GetProperty("value").GetString());
```

It must then `GET` the nested resources route, assert one resource, and assert that no `/resource-pages` call is needed.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter Navigation_Flow_CreatesResourceDirectlyInsidePageVersion
```

Expected: FAIL because the nested resource route and response shape do not exist.

- [ ] **Step 3: Change the entity graph**

Implement these exact relationships:

```csharp
public class Resource
{
    public Guid Id { get; set; }
    public Guid PageVersionId { get; set; }
    public required string Name { get; set; }
    public string? NormalizedName { get; set; }
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public PageVersion PageVersion { get; set; } = null!;
    public ICollection<ResourceVersion> Versions { get; set; } = new List<ResourceVersion>();
}
```

Replace `PageVersion.ResourcePages` with `ICollection<Resource> Resources`; remove `Project.Resources`; remove `ResourceVersion.ResourcePages`; delete the `ResourcePage` model and DbSet.

Configure `Resource` with cascade FK to `PageVersion` and indexes `(PageVersionId, IsDeleted)` and `(PageVersionId, NormalizedName)`.

- [ ] **Step 4: Replace resource contracts and nested service/controller methods**

`CreateResourceRequest` becomes:

```csharp
public class CreateResourceRequest
{
    [Required, MaxLength(200)] public string? Key { get; set; }
    [MaxLength(2000)] public string? Description { get; set; }
    [Required, MaxLength(20)] public string? LanguageCode { get; set; }
    [Required] public string? Value { get; set; }
}
```

Create a composite response contract:

```csharp
public class CreateResourceResponse
{
    public required ResourceResponse Resource { get; set; }
    public required ResourceVersionResponse ResourceVersion { get; set; }
}
```

All resource list/update/delete operations accept `projectId`, `pageId`, `pageVersionId` and validate the full tree before querying or mutating. Remove all `ResourcePage` methods and controller actions.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run the same filtered command. Expected: one passing test and no build errors.

- [ ] **Step 6: Add hierarchy and atomicity coverage**

Add tests proving:

- A resource created under page version A is absent from page version B.
- A page version from another page/project returns `404` and creates no resource.
- A non-member receives `403` and creates no resource.
- Invalid initial translation data returns `400` and creates neither entity.

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter "Navigation_Flow|ResourceHierarchy"
```

Expected: all focused tests pass.

---

### Task 2: Language-Coded Resource Versions

**Files:**
- Create: `src/resources-api/Services/SupportedLanguages.cs`
- Modify: `src/resources-api-test/ApiIntegrationTests.cs`
- Modify: `src/resources-api/Models/ResourceVersion.cs`
- Modify: `src/resources-api/Data/AppDbContext.cs`
- Modify: `src/resources-api/Contracts/CreateResourceVersionRequest.cs`
- Modify: `src/resources-api/Contracts/UpdateResourceVersionRequest.cs`
- Modify: `src/resources-api/Contracts/ResourceVersionResponse.cs`
- Modify: `src/resources-api/Services/NavigationService.cs`
- Modify: `src/resources-api/Controllers/NavigationController.cs`

**Interfaces:**
- Produces: `SupportedLanguages.NormalizeAndValidate(string? code)` returning normalized lowercase code or throwing `NavigationException(HttpStatusCode.BadRequest, ...)`.
- Produces: nested resource-version CRUD routes below the resource route from Task 1.
- Produces: `ResourceVersionResponse.LanguageCode`; removes `Name` and `IsDefault`.

- [ ] **Step 1: Write failing language validation tests**

Add integration tests for:

```csharp
new { languageCode = "PT-BR", value = "Olá" } // Created, response is "pt-br"
new { languageCode = "fr-fr", value = "Bonjour" } // BadRequest
new { languageCode = "es-es", value = "Duplicado" } // Conflict when es-es exists
```

Also assert that creating `en-uk` after `es-es` succeeds and that no response contains `name` or `isDefault`.

- [ ] **Step 2: Run tests and verify RED**

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter ResourceLanguages
```

Expected: FAIL because language validation and nested version routes are absent.

- [ ] **Step 3: Implement the language catalog**

```csharp
public static class SupportedLanguages
{
    private static readonly HashSet<string> Codes = new(StringComparer.OrdinalIgnoreCase)
    {
        "pt-br", "es-es", "en-uk"
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
```

- [ ] **Step 4: Replace resource-version fields and defaults**

`ResourceVersion` and its request/response contracts expose `LanguageCode` and `Value`; remove `Name` and `IsDefault`. Delete `SetDefaultResourceVersionAsync`, `ClearDefaultResourceVersionAsync` and the controller `set-default` endpoint.

Configure `LanguageCode` as required with max length 20 and a unique index on `(ResourceId, LanguageCode)`. Before inserting, query active versions and return `409 Conflict` for duplicates so the API does not leak a database exception.

- [ ] **Step 5: Nest version CRUD under the complete hierarchy**

Use these routes:

```text
GET|POST   pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions
PUT|DELETE pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/versions/{resourceVersionId}
```

Each operation validates resource membership in the requested `PageVersion`.

- [ ] **Step 6: Run language and navigation tests**

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter "ResourceLanguages|Navigation"
```

Expected: all selected tests pass.

---

### Task 3: Destructive EF Migration from an Empty Database

**Files:**
- Create: `src/resources-api/Data/Migrations/<timestamp>_SimplifyResourceHierarchy.cs`
- Create: `src/resources-api/Data/Migrations/<timestamp>_SimplifyResourceHierarchy.Designer.cs`
- Modify: `src/resources-api/Data/Migrations/AppDbContextModelSnapshot.cs` if generated by the installed EF tooling.

**Interfaces:**
- Consumes: entity mappings from Tasks 1 and 2.
- Produces: schema with no `ResourcePages`, required `Resources.PageVersionId`, and language-coded resource versions.

- [ ] **Step 1: Verify the model compiles before migration generation**

```bash
dotnet build src/resources-api/resources-api.csproj
```

Expected: build succeeds.

- [ ] **Step 2: Generate the migration**

```bash
dotnet ef migrations add SimplifyResourceHierarchy --project src/resources-api/resources-api.csproj --startup-project src/resources-api/resources-api.csproj
```

Expected migration order:

1. Drop `ResourcePages` and resource-version default indexes/computed column.
2. Drop the `Resources.ProjectId` FK and indexes.
3. Add required `Resources.PageVersionId` and its FK/indexes.
4. Rename or replace `ResourceVersions.Name` with `LanguageCode`.
5. Drop `ResourceVersions.IsDefault`.
6. Add unique `(ResourceId, LanguageCode)` index.

- [ ] **Step 3: Inspect the generated migration**

Reject and correct any migration that preserves a `ResourcePage` table, creates a shadow `ResourceId`, leaves a resource-version default slot, or introduces `LanguageCode` on `Resource`.

- [ ] **Step 4: Recreate and migrate the development database**

Stop the API first, then remove the development database using the repository's Docker/MySQL workflow and restart the API so migrations run from empty state.

Verify through EF metadata in a test:

```csharp
Assert.Null(context.Model.FindEntityType("resources_api.Models.ResourcePage"));
Assert.NotNull(context.Model.FindEntityType(typeof(Resource))!.FindProperty(nameof(Resource.PageVersionId)));
Assert.Null(context.Model.FindEntityType(typeof(Resource))!.FindProperty("ProjectId"));
Assert.Null(context.Model.FindEntityType(typeof(ResourceVersion))!.FindProperty("IsDefault"));
```

- [ ] **Step 5: Run all backend tests**

```bash
dotnet test src/resources-api-test/resources-api-test.csproj
```

Expected: all tests pass from the new model.

---

### Task 4: Frontend API, Route and State Simplification

**Files:**
- Modify: `src/resources-app-test/App.integration.test.tsx`
- Modify: `src/resources-app/src/api.ts`
- Modify: `src/resources-app/src/App.tsx`

**Interfaces:**
- Consumes: nested REST contracts from Tasks 1 and 2.
- Produces: `RouteInfo` ending at `resourceId`, direct page-version resources, and language-coded resource versions.
- Removes: `ResourcePageResponse`, `getResourcePages`, `postResourcePage`, `resourcePageId` and all resource-linking state.

- [ ] **Step 1: Rewrite the hierarchy integration test for direct resources**

Update `navigates across hierarchy levels from project to resource detail` so mocks expect:

```text
GET  /pages/page-1/versions/page-version-1/resources
POST /pages/page-1/versions/page-version-1/resources
GET  /pages/page-1/versions/page-version-1/resources/resource-1/versions
POST /pages/page-1/versions/page-version-1/resources/resource-1/versions
```

Remove all `/resource-pages` and resource-version `set-default` mocks. Assert navigation ends at:

```text
/projects/project-1/page-1/page-version-1/resource-1
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd src/resources-app-test && npm test -- --run App.integration.test.tsx -t "navigates across hierarchy"
```

Expected: FAIL on old resource-page calls or old route parsing.

- [ ] **Step 3: Replace frontend API types and functions**

Use these response types:

```typescript
export type ResourceResponse = {
  id: string
  pageVersionId: string
  key: string
  description: string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}

export type ResourceVersionResponse = {
  id: string
  resourceId: string
  languageCode: string
  value: string
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}
```

All resource and resource-version functions receive `projectId`, `pageId`, and `pageVersionId`. Remove ResourcePage functions and `setDefaultResourceVersion`.

- [ ] **Step 4: Simplify route parsing and state**

Remove `resourcePageId` from `RouteInfo` and `resolveRoute`. Remove:

```typescript
resourcePages
resourcePagesLoading
isCreateResourcePageModalOpen
newResourcePageResourceVersionId
handleCreateResourcePage
handleSetDefaultResourceVersion
```

At page-version level, load direct resources. At resource level, load its language versions. Remove the resource-page detail branch and linking modal.

- [ ] **Step 5: Run focused test and TypeScript build**

```bash
cd src/resources-app-test && npm test -- --run App.integration.test.tsx -t "navigates across hierarchy"
cd ../resources-app && npm run build
```

Expected: focused test and build pass with no ResourcePage imports.

---

### Task 5: Language Selector and Local Flags

**Files:**
- Create: `src/resources-app/src/languages.ts`
- Create: `src/resources-app/public/flags/pt-br.svg`
- Create: `src/resources-app/public/flags/es-es.svg`
- Create: `src/resources-app/public/flags/en-uk.svg`
- Create: `src/resources-app/public/flags/LICENSE.flag-icons.txt`
- Modify: `src/resources-app/src/App.tsx`
- Modify: `src/resources-app/src/App.css`
- Modify: `src/resources-app-test/App.integration.test.tsx`

**Interfaces:**
- Produces: `SUPPORTED_LANGUAGES` and `SupportedLanguageCode`.
- Consumes: `ResourceVersionResponse.languageCode` from Task 4.

- [ ] **Step 1: Add failing selector tests**

Test resource creation with:

- `Key del recurso nuevo`.
- `Idioma inicial` select containing `Português (Brasil)`, `Español`, and `English (United Kingdom)`.
- `Valor de la traducción inicial`.
- POST payload `{ key, description, languageCode: 'es-es', value }`.

In resource detail, mock an existing `es-es` version and assert the add-language selector offers `pt-br` and `en-uk` but not `es-es`.

- [ ] **Step 2: Run selector tests and verify RED**

```bash
cd src/resources-app-test && npm test -- --run App.integration.test.tsx -t "language|idioma|recurso"
```

Expected: FAIL because the selector and catalog do not exist.

- [ ] **Step 3: Add the frontend catalog**

```typescript
export const SUPPORTED_LANGUAGES = [
  { code: 'pt-br', label: 'Português (Brasil)', flagSrc: '/flags/pt-br.svg' },
  { code: 'es-es', label: 'Español', flagSrc: '/flags/es-es.svg' },
  { code: 'en-uk', label: 'English (United Kingdom)', flagSrc: '/flags/en-uk.svg' },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']
```

- [ ] **Step 4: Download and attribute flag assets**

Download `br.svg`, `es.svg`, and `gb.svg` from `lipis/flag-icons` into the code-based filenames. Add the upstream MIT license as `LICENSE.flag-icons.txt`. Verify each SVG is non-empty and contains an `<svg` root.

- [ ] **Step 5: Implement selectors and translation display**

The native `<select>` provides accessible text labels; render the currently selected flag beside it because native option images are not portable. Translation list rows render the local flag, language label/code and value. Stable flag dimensions prevent layout shift.

On resource creation require key, language and value. On adding a translation, calculate:

```typescript
const availableLanguages = SUPPORTED_LANGUAGES.filter(
  (language) => !resourceVersions.some((version) => version.languageCode === language.code),
)
```

- [ ] **Step 6: Run focused frontend tests and visual checks**

```bash
cd src/resources-app-test && npm test -- --run App.integration.test.tsx -t "language|idioma|recurso"
cd ../resources-app && npm run build && npm run lint
```

Then verify desktop and 390×844 mobile layouts: modal centered, select text visible, flags loaded, no horizontal overflow.

---

### Task 6: Documentation and Full Regression

**Files:**
- Verify: `docs/funcional-spec.md`
- Verify: `docs/04-feature-navigation/SPEC.md`
- Verify: `docs/superpowers/specs/2026-07-25-simplified-resource-hierarchy-design.md`
- Modify: `README.md` only if it documents old resource routes or database reset instructions.

**Interfaces:**
- Consumes: completed backend/frontend behavior.
- Produces: verified repository with no executable ResourcePage behavior.

- [ ] **Step 1: Search for stale behavior**

```bash
grep -RInE 'ResourcePage|resourcePage|resource-pages|setDefaultResourceVersion|DefaultVersionSlot' src --exclude-dir=bin --exclude-dir=obj --exclude-dir=dist
```

Expected: no source references. Generated historical migration references are acceptable only in older migration files; the current EF model must not contain them.

- [ ] **Step 2: Run complete backend verification**

```bash
dotnet test src/resources-api-test/resources-api-test.csproj
```

Expected: all tests pass.

- [ ] **Step 3: Run complete frontend verification**

```bash
npm --prefix src/resources-app-test test
npm --prefix src/resources-app run build
npm --prefix src/resources-app run lint
```

Expected: all tests pass; build and lint exit zero.

- [ ] **Step 4: Check diagnostics and diff integrity**

Run workspace diagnostics on all touched C#/TS/TSX files and:

```bash
git diff --check
git status --short
```

Expected: no new compile diagnostics, no whitespace errors, and only planned files changed.

- [ ] **Step 5: Final behavior check**

From a clean database: create project → page → page version → resource with `es-es` → add `pt-br` → verify both translations and flags → verify duplicate `es-es` is unavailable in UI and rejected with `409` by API.