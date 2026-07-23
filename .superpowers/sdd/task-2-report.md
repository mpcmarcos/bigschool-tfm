# Task 2 Report — EF Core schema and domain models

## Outcome
Implemented the navigation hierarchy persistence layer for:
- `Page`
- `PageVersion`
- `Resource`
- `ResourceVersion`
- `ResourcePage`

## Changes made

### Models added
Created new EF/domain models under `src/resources-api/Models/`:
- `Page.cs`
- `PageVersion.cs`
- `Resource.cs`
- `ResourceVersion.cs`
- `ResourcePage.cs`

### Existing models updated
- `Project.cs`
  - Added `Pages` and `Resources` navigation collections.
- `AppDbContext.cs`
  - Added DbSets for all new entities.
  - Added Fluent config for keys, relationships, indexes, soft-delete fields, and computed-column uniqueness enforcement.
  - Added portable uniqueness enforcement for one default `PageVersion` per `Page` and one default `ResourceVersion` per `Resource`.

### Migration added
Created migration files:
- `src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.cs`
- `src/resources-api/Data/Migrations/20260723204000_AddNavigationHierarchySchema.Designer.cs`

### Schema summary
- `Pages` belongs to `Projects`.
- `PageVersions` belongs to `Pages`.
- `Resources` belongs to `Projects`.
- `ResourceVersions` belongs to `Resources`.
- `ResourcePages` links `PageVersion` to `ResourceVersion`.
- Soft delete fields (`IsDeleted`) and timestamps were added on the new entities.
- Portable unique indexes enforce exactly one default version per parent entity.

## Verification
- `dotnet build src/resources-api/resources-api.csproj --nologo` ✅
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_" --nologo` ❌ expected red (endpoints still missing)
- `dotnet test src/resources-api-test/resources-api-test.csproj --nologo` ❌ expected red for the same navigation tests; all unrelated tests pass

## Notes / concerns
- I did not change `User.cs` because the navigation schema did not require new user-owned relationships.
- Navigation endpoint implementation is still pending, so the red integration tests are preserved as intended.

## Post-review fixes
- Added the missing `DbSet<Page>`, `DbSet<PageVersion>`, `DbSet<Resource>`, `DbSet<ResourceVersion>`, and `DbSet<ResourcePage>` properties to `AppDbContext`.
- Replaced the filtered unique index strategy for default-version uniqueness with a portable computed-column approach:
  - `DefaultVersionSlot` is computed from `IsDefault`/`IsDeleted`
  - unique indexes now target `(PageId, DefaultVersionSlot)` and `(ResourceId, DefaultVersionSlot)`
  - this works on both SQLite and MySQL while still allowing multiple non-default versions
- Updated the migration and designer snapshot to match the new schema.

## Verification after review
- `dotnet build src/resources-api/resources-api.csproj --nologo` ✅
  - Build succeeded with 0 warnings and 0 errors.
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_" --nologo` ❌
  - 4 navigation tests still fail because the navigation endpoints are not implemented yet (404/JSON parsing), which is outside this schema-only task scope.

## Current validation run
- `dotnet build src/resources-api/resources-api.csproj --nologo` ✅
  - `Build succeeded.`
  - `0 Warning(s), 0 Error(s)`
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_" --nologo` ❌
  - 4 tests failed:
    - `Navigation_InvalidHierarchy_ReturnsBadRequestOrNotFound`
    - `Navigation_NonMemberAccess_ReturnsForbidden`
    - `Navigation_Defaults_AreUniquePerParent`
    - `Navigation_Flow_CreatePagePageVersionResourceResourceVersionResourcePage_WorksAsExpected`
  - Failures are endpoint behavior/response-shape gaps, not schema compilation issues.
