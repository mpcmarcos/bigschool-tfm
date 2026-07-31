# Task 2 Report — Atomic automatic translations API

## Outcome
Implemented authenticated, atomic automatic translation generation at:

- `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/automatic-translations`

The endpoint now validates access/hierarchy/source language, computes canonical pending targets, invokes `IAutomaticTranslationClient`, validates exact semantic output, rechecks active languages in a transaction after provider return, and persists all generated translations in one commit or none.

## Files changed

- `src/resources-api/Contracts/GenerateAutomaticTranslationsRequest.cs` (created)
- `src/resources-api/Contracts/AutomaticTranslationsResponse.cs` (created)
- `src/resources-api/Services/SupportedLanguages.cs`
- `src/resources-api/Services/NavigationService.cs`
- `src/resources-api/Controllers/NavigationController.cs`
- `src/resources-api-test/ApiIntegrationTests.cs`

## TDD evidence

### Red command and failure

Command:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
```

Observed red:

- Focused suite failed with 14 failures.
- Primary failure mode before implementation: `NotFound` for the missing route and empty-body JSON parse failures when tests expected created/problem payloads.
- Representative mismatch examples:
  - expected `Unauthorized`, actual `NotFound`
  - expected `UnprocessableEntity`, actual `NotFound`
  - expected `Conflict`, actual `NotFound`

### Green commands and exact pass counts

Focused automatic translations:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
```

Result:

- total: 15
- failed: 0
- succeeded: 15
- skipped: 0

Full backend regression:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj
```

Result:

- total: 46
- failed: 0
- succeeded: 46
- skipped: 0

## Behavior coverage implemented

- Deterministic fake provider registration in integration tests via DI override (`RemoveAll<IAutomaticTranslationClient>()` + singleton fake).
- Happy path:
  - returns `201`
  - returns two generated translations when source is `es-es`
  - follow-up GET has exactly three active translations
  - provider call input asserted exactly:
    - source language `es-es`
    - source value `Hola`
    - targets `pt-br`, `en-uk` in canonical order
- Guardrails with no provider call:
  - unauthenticated (`401`)
  - viewer role (`403`)
  - invalid hierarchy (`400` or `404` depending on hierarchy path)
  - missing source translation (`400`)
  - unsupported source language (`400`)
  - no pending target languages (`400`)
- Provider exception mapping:
  - `InvalidResponse` -> `502 BadGateway` with exact required message in service mapping
  - `Unavailable` -> `503 ServiceUnavailable` with non-sensitive message
- Domain boundary validation of provider output (defensive exact-set check in service even if provider already validates):
  - partial result
  - duplicate language
  - extra language
  - unsupported language
  - empty value
  - all return `422 UnprocessableEntity` and persist nothing
- All-or-nothing and concurrency:
  - fake hook performs concurrent insertion of one target using separate `AppDbContext` immediately before returning
  - service rechecks active language set inside transaction
  - mismatch returns `409 Conflict`
  - verifies operation does not insert remaining generated target

## Implementation notes

- `SupportedLanguages` now exposes canonical order through `All` while preserving validation.
- `NavigationService` now injects `IAutomaticTranslationClient`.
- Provider invocation is deliberately outside transaction scope.
- Transaction starts only after provider output passes semantic validation.
- On `DbUpdateException`, transaction rolls back, added tracked entities are detached, and `409` is returned without provider details.
- Controller endpoint follows existing `TryGetUserId` + `NavigationException` pattern and returns `201` body through `StatusCode`.

## Self-review

- Confirmed no OpenAI network calls are made in tests; integration suite uses fake provider.
- Confirmed no user secret values were accessed, listed, or exposed.
- Confirmed Task 1 provider implementation was not reverted or modified.
- Confirmed changes are limited to backend API/contracts/tests required for Task 2.
- Confirmed required second DB recheck after provider return is present in transaction path.

## Concerns

- The generated translations are returned in canonical target order based on `SupportedLanguages.All`; this currently matches requirements and tests but depends on maintaining canonical order centrally.
- `422` responses currently use shared semantic mismatch messages rather than per-case granular diagnostics by design to avoid leaking provider internals.

## Task 2 Review Fix Cycle (2026-07-25)

### Findings addressed

- Strengthened happy-path assertions to validate exact `201` translation languages, values, and canonical order, plus exact persisted language/value pairs.
- Added deterministic `DbUpdateException` coverage during automatic translation `SaveChanges` using test-only EF `SaveChangesInterceptor` and test DI wiring. The failure is armed only during the automatic operation via fake-provider callback.
- Added explicit `RollbackAsync` before throwing the post-provider recheck conflict.

### Changed files in this fix cycle

- `src/resources-api-test/ApiIntegrationTests.cs`
- `src/resources-api/Services/NavigationService.cs`
- `.superpowers/sdd/task-2-report.md`

### Red/green evidence (exact commands and results)

Red checkpoint command:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
```

Observed result at red checkpoint:

- No failures reproduced (baseline already green with the stricter/new tests in this branch).
- total: 16
- failed: 0
- succeeded: 16
- skipped: 0

Green focused command:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
```

Green focused result:

- total: 16
- failed: 0
- succeeded: 16
- skipped: 0

Green backend regression command:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj
```

Green backend regression result:

- total: 47
- failed: 0
- succeeded: 47
- skipped: 0

## Task 2 Remaining Review Issue Closure (2026-07-25)

### Required fix applied

- Kept both conflict responses as `409` with distinct stable details:
  - post-provider recheck path: `"Resource translations changed during automatic translation generation."`
  - `DbUpdateException` catch path: `"Automatic translations could not be saved due to a concurrent update."`
- Strengthened deterministic interceptor test to assert the exact catch-path detail and that only the source translation persists, preventing accidental pass through the earlier recheck branch.

### Mutation sensitivity proof (temporary, reverted)

Temporary mutation performed:

- changed catch-path detail to the recheck detail in `NavigationService`.

Command:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~AutomaticTranslations_DbUpdateExceptionAfterRecheck_ReturnsConflict_AndPersistsOnlySource"
```

Expected red observed:

- total: 1
- failed: 1
- succeeded: 0
- skipped: 0
- assertion excerpt:
  - `Assert.Equal() Failure: Strings differ`
  - `Expected: "Automatic translations could not be saved"...`
  - `Actual:   "Resource translations changed during auto"...`

Mutation status:

- Reverted immediately; production code restored with distinct recheck/catch conflict details.

### Final green evidence after restore

Single named test:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter "FullyQualifiedName~AutomaticTranslations_DbUpdateExceptionAfterRecheck_ReturnsConflict_AndPersistsOnlySource"
```

- total: 1
- failed: 0
- succeeded: 1
- skipped: 0

Focused automatic translations:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
```

- total: 16
- failed: 0
- succeeded: 16
- skipped: 0

Full backend suite:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj
```

- total: 47
- failed: 0
- succeeded: 47
- skipped: 0
