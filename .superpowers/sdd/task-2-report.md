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
  - Added Fluent config for keys, relationships, indexes, and soft-delete fields.
  - Added filtered unique indexes to enforce one default `PageVersion` per `Page` and one default `ResourceVersion` per `Resource`.

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
- Filtered unique indexes enforce exactly one default version per parent entity.

## Verification
- `dotnet build src/resources-api/resources-api.csproj --nologo` ✅
- `dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~Navigation_" --nologo` ❌ expected red (endpoints still missing)
- `dotnet test src/resources-api-test/resources-api-test.csproj --nologo` ❌ expected red for the same navigation tests; all unrelated tests pass

## Notes / concerns
- I did not change `User.cs` because the navigation schema did not require new user-owned relationships.
- Navigation endpoint implementation is still pending, so the red integration tests are preserved as intended.
