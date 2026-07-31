# Automatic Translations with OpenAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated action that generates every missing resource translation through OpenAI Responses API and persists the complete result atomically.

**Architecture:** React sends only the selected source language to ASP.NET Core. `NavigationService` resolves the source text and pending languages, invokes an isolated `IAutomaticTranslationClient`, validates the exact result, then rechecks and inserts all translations in one explicit database transaction. The OpenAI adapter uses `POST /v1/responses`, `store: false`, no conversation or tools, and strict Structured Outputs.

**Tech Stack:** ASP.NET Core 8, EF Core 8, `IHttpClientFactory`, OpenAI Responses REST API, React 19, TypeScript, Vitest, xUnit.

## Global Constraints

- Keep the hierarchy `Project -> Page -> PageVersion -> Resource -> ResourceVersion`; do not add entities or migrations.
- The request body contains only `sourceLanguageCode`; the API obtains `sourceValue` and target languages from the database.
- Generate all currently missing supported languages, never a caller-selected subset.
- Call OpenAI before opening the database transaction.
- Persist every generated translation or none; never overwrite an active translation.
- Do not retry OpenAI automatically because retries can duplicate cost and return different text.
- Use `store: false`, no `conversation`, no `previous_response_id`, and no tools.
- Do not put `OpenAI:ApiKey` in source files, `appsettings*.json`, Dockerfiles, logs, frontend variables, tests, or Git.
- Automated tests must replace the provider and must not call OpenAI or consume API credit.
- Do not commit unless the user explicitly requests it.

## File Structure

**Create:**

- `src/resources-api/Options/OpenAiOptions.cs`: non-secret and secret provider settings bound from configuration.
- `src/resources-api/Services/IAutomaticTranslationClient.cs`: provider-independent input, output, failure types, and interface.
- `src/resources-api/Services/OpenAiAutomaticTranslationClient.cs`: Responses API HTTP adapter and response parser.
- `src/resources-api/Contracts/GenerateAutomaticTranslationsRequest.cs`: public API request DTO.
- `src/resources-api/Contracts/AutomaticTranslationsResponse.cs`: public API response wrapper.
- `src/resources-api-test/OpenAiAutomaticTranslationClientTests.cs`: adapter contract tests with an in-memory HTTP handler.

**Modify:**

- `src/resources-api/Program.cs`: bind options and register the typed `HttpClient`.
- `src/resources-api/appsettings.json`: add non-secret OpenAI defaults only.
- `src/resources-api/Services/SupportedLanguages.cs`: expose a stable read-only list for target calculation.
- `src/resources-api/Services/NavigationService.cs`: orchestrate authorization, provider call, validation, recheck, and atomic insert.
- `src/resources-api/Controllers/NavigationController.cs`: expose the automatic translation endpoint.
- `src/resources-api-test/ApiIntegrationTests.cs`: replace the provider and cover API behavior and atomicity.
- `src/resources-app/src/api.ts`: add request/response types and authenticated POST wrapper.
- `src/resources-app/src/App.tsx`: add conditional action, modal, source selection, loading, success, and error behavior.
- `src/resources-app/src/App.css`: style the read-only source and target list only if existing classes are insufficient.
- `src/resources-app-test/App.integration.test.tsx`: cover visibility, payload, success, and failure.
- `README.md`: document local secret setup and non-secret configuration.

---

### Task 1: Provider-independent translation client and OpenAI adapter

**Files:**

- Create: `src/resources-api/Options/OpenAiOptions.cs`
- Create: `src/resources-api/Services/IAutomaticTranslationClient.cs`
- Create: `src/resources-api/Services/OpenAiAutomaticTranslationClient.cs`
- Create: `src/resources-api-test/OpenAiAutomaticTranslationClientTests.cs`
- Modify: `src/resources-api/Program.cs`
- Modify: `src/resources-api/appsettings.json`

**Interfaces:**

- Consumes: configuration keys `OpenAI:ApiKey`, `OpenAI:BaseUrl`, `OpenAI:Model`, `OpenAI:TimeoutSeconds`, and `OpenAI:MaxOutputTokens`.
- Produces: `Task<IReadOnlyList<GeneratedTranslation>> GenerateAsync(AutomaticTranslationInput input, CancellationToken cancellationToken)`.

- [ ] **Step 1: Write failing adapter tests**

Create `OpenAiAutomaticTranslationClientTests.cs` with a recording `HttpMessageHandler`. The happy-path test must assert the request URI, bearer authentication, and these payload properties:

```csharp
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
```

Return an in-memory completed response whose `output[0].content[0]` is:

```json
{
  "type": "output_text",
  "text": "{\"translations\":[{\"languageCode\":\"pt-br\",\"value\":\"Olá\"},{\"languageCode\":\"en-uk\",\"value\":\"Hello\"}]}"
}
```

Assert the two `GeneratedTranslation` values. Add theories asserting:

```text
missing API key                 -> TranslationProviderFailure.Unavailable
HTTP 429                        -> TranslationProviderFailure.Unavailable
HTTP 500                        -> TranslationProviderFailure.Unavailable
HTTP 400                        -> TranslationProviderFailure.InvalidResponse
status incomplete              -> TranslationProviderFailure.InvalidResponse
content type refusal           -> TranslationProviderFailure.InvalidResponse
missing output_text            -> TranslationProviderFailure.InvalidResponse
invalid output_text JSON       -> TranslationProviderFailure.InvalidResponse
TaskCanceledException timeout  -> TranslationProviderFailure.Unavailable
```

- [ ] **Step 2: Run the adapter tests and verify red**

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter OpenAiAutomaticTranslationClientTests
```

Expected: build failure because the options, interface, records, exception, and adapter do not exist.

- [ ] **Step 3: Define options and provider-independent contracts**

Create `OpenAiOptions.cs`:

```csharp
namespace resources_api.Options;

public sealed class OpenAiOptions
{
    public const string SectionName = "OpenAI";
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.openai.com/v1/";
    public string Model { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 60;
    public int MaxOutputTokens { get; set; } = 2000;
}
```

Create `IAutomaticTranslationClient.cs`:

```csharp
namespace resources_api.Services;

public sealed record AutomaticTranslationInput(
    string SourceLanguageCode,
    string SourceValue,
    IReadOnlyList<string> TargetLanguageCodes);

public sealed record GeneratedTranslation(string LanguageCode, string Value);

public enum TranslationProviderFailure
{
    InvalidResponse,
    Unavailable
}

public sealed class AutomaticTranslationProviderException : Exception
{
    public AutomaticTranslationProviderException(TranslationProviderFailure failure, string message, Exception? innerException = null)
        : base(message, innerException) => Failure = failure;

    public TranslationProviderFailure Failure { get; }
}

public interface IAutomaticTranslationClient
{
    Task<IReadOnlyList<GeneratedTranslation>> GenerateAsync(
        AutomaticTranslationInput input,
        CancellationToken cancellationToken);
}
```

- [ ] **Step 4: Implement the Responses API adapter**

Implement `OpenAiAutomaticTranslationClient` with `HttpClient` and `IOptions<OpenAiOptions>`. Build the JSON with `System.Text.Json` so user text is never concatenated into JSON manually. The request must include:

```csharp
var payload = new
{
    model = _options.Model,
    store = false,
    max_output_tokens = _options.MaxOutputTokens,
    instructions = "Translate the source text into every requested target language. Preserve meaning, tone, capitalization, line breaks, HTML tags, technical fragments, and placeholders such as {name}, {{count}}, %s, and ${value}. Return only the structured result.",
    input = JsonSerializer.Serialize(new
    {
      sourceLanguageCode = input.SourceLanguageCode,
      sourceValue = input.SourceValue,
      targetLanguageCodes = input.TargetLanguageCodes
    }),
    text = new
    {
        format = new
        {
            type = "json_schema",
            name = "automatic_translations",
            strict = true,
            schema = BuildSchema(input.TargetLanguageCodes)
        }
    }
};
```

`BuildSchema` must return a root object with required `translations`, an array item object with required `languageCode` and `value`, target codes as the only enum values, and `additionalProperties = false` on both objects. Set array `minItems` and `maxItems` to the target count.

Send a fresh `HttpRequestMessage` to `responses`, attach `Bearer _options.ApiKey`, parse only `status == "completed"`, reject `refusal`, locate one `output_text`, and deserialize it case-insensitively into an internal response type. Never log the request body, response body, or authorization header.

Map `429`, `5xx`, timeout, connection failure, missing configuration, and cancellation not requested by the caller to `Unavailable`. Map other provider errors, incomplete/refused output, missing content, and malformed JSON to `InvalidResponse`. Preserve caller cancellation by rethrowing when `cancellationToken.IsCancellationRequested`.

- [ ] **Step 5: Register configuration and typed client**

Add only non-secret defaults to `appsettings.json`:

```json
"OpenAI": {
  "BaseUrl": "https://api.openai.com/v1/",
  "Model": "gpt-5-mini",
  "TimeoutSeconds": 60,
  "MaxOutputTokens": 2000
}
```

Register in `Program.cs`:

```csharp
builder.Services.Configure<OpenAiOptions>(builder.Configuration.GetSection(OpenAiOptions.SectionName));
builder.Services.AddHttpClient<IAutomaticTranslationClient, OpenAiAutomaticTranslationClient>((serviceProvider, client) =>
{
    var options = serviceProvider.GetRequiredService<IOptions<OpenAiOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl);
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
});
```

Do not add an OpenAI SDK package; the REST contract is small and the existing framework already provides `HttpClient`, JSON, options, and DI.

- [ ] **Step 6: Run focused and backend regression tests**

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter OpenAiAutomaticTranslationClientTests
dotnet test src/resources-api-test/resources-api-test.csproj
```

Expected: adapter tests pass and the existing backend suite remains green without requiring `OpenAI:ApiKey` because no existing endpoint resolves the typed client yet.

---

### Task 2: Atomic automatic translation API operation

**Files:**

- Create: `src/resources-api/Contracts/GenerateAutomaticTranslationsRequest.cs`
- Create: `src/resources-api/Contracts/AutomaticTranslationsResponse.cs`
- Modify: `src/resources-api/Services/SupportedLanguages.cs`
- Modify: `src/resources-api/Services/NavigationService.cs`
- Modify: `src/resources-api/Controllers/NavigationController.cs`
- Modify: `src/resources-api-test/ApiIntegrationTests.cs`

**Interfaces:**

- Consumes: `IAutomaticTranslationClient.GenerateAsync(...)` from Task 1.
- Produces: `POST /api/v1/projects/{projectId}/pages/{pageId}/versions/{pageVersionId}/resources/{resourceId}/automatic-translations` returning `201` and `{ "translations": ResourceVersionResponse[] }`.

- [ ] **Step 1: Add a deterministic fake provider to integration tests**

Add a test-only implementation with recorded calls and configurable result/failure:

```csharp
private sealed class FakeAutomaticTranslationClient : IAutomaticTranslationClient
{
    public List<AutomaticTranslationInput> Calls { get; } = [];
    public IReadOnlyList<GeneratedTranslation> Result { get; set; } = [];
    public AutomaticTranslationProviderException? Failure { get; set; }

    public Task<IReadOnlyList<GeneratedTranslation>> GenerateAsync(
        AutomaticTranslationInput input,
        CancellationToken cancellationToken)
    {
        Calls.Add(input);
        if (Failure is not null)
        {
            throw Failure;
        }

        return Task.FromResult(Result);
    }
}
```

Register one instance in `WebApplicationFactory` with `ConfigureTestServices`, removing the production registration first:

```csharp
services.RemoveAll<IAutomaticTranslationClient>();
services.AddSingleton<IAutomaticTranslationClient>(_translationClient);
```

- [ ] **Step 2: Write failing happy-path and authorization tests**

Create a resource with `es-es`, configure the fake to return `pt-br` and `en-uk`, then POST:

```json
{ "sourceLanguageCode": "es-es" }
```

Assert `201`, two response items, and a subsequent GET contains exactly three active translations. Assert the recorded provider input is:

```csharp
Assert.Equal("es-es", call.SourceLanguageCode);
Assert.Equal("Hola", call.SourceValue);
Assert.Equal(new[] { "pt-br", "en-uk" }, call.TargetLanguageCodes);
```

Add tests proving unauthenticated, viewer, wrong hierarchy, missing source, unsupported source, and no pending languages do not call the fake. Expected statuses are respectively `401`, `403`, `400` or `404` according to the existing hierarchy behavior, `400`, `400`, and `400`.

- [ ] **Step 3: Run API tests and verify red**

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
```

Expected: failure because the request/response contracts, service method, and route do not exist.

- [ ] **Step 4: Add public request and response contracts**

Create:

```csharp
namespace resources_api.Contracts;

public sealed class GenerateAutomaticTranslationsRequest
{
    public string? SourceLanguageCode { get; set; }
}
```

```csharp
namespace resources_api.Contracts;

public sealed class AutomaticTranslationsResponse
{
    public required IReadOnlyList<ResourceVersionResponse> Translations { get; init; }
}
```

- [ ] **Step 5: Expose the canonical language order**

Replace the private-only language set with an ordered list plus validation set:

```csharp
private static readonly string[] OrderedCodes = ["pt-br", "es-es", "en-uk"];
private static readonly HashSet<string> Codes = new(OrderedCodes, StringComparer.OrdinalIgnoreCase);

public static IReadOnlyList<string> All { get; } = Array.AsReadOnly(OrderedCodes);
```

The order is part of provider request determinism, not a database contract.

- [ ] **Step 6: Implement orchestration and exact-result validation**

Inject `IAutomaticTranslationClient` into `NavigationService`. Add:

```csharp
public Task<AutomaticTranslationsResponse> GenerateAutomaticTranslationsAsync(
    Guid userId,
    Guid projectId,
    Guid pageId,
    Guid pageVersionId,
    Guid resourceId,
    GenerateAutomaticTranslationsRequest request,
    CancellationToken cancellationToken)
```

The method must execute in this order:

1. Require manage permission, hierarchy, and active resource using existing helpers.
2. Normalize `request.SourceLanguageCode` with `SupportedLanguages.NormalizeAndValidate`.
3. Query the active source `ResourceVersion`; return `400` if it is absent.
4. Query active language codes and calculate `targets = SupportedLanguages.All.Except(activeCodes)` in canonical order; return `400` when empty.
5. Call the provider before opening a transaction.
6. Map provider `InvalidResponse` to `NavigationException(HttpStatusCode.BadGateway, "The translation provider returned an invalid response.")` and `Unavailable` to `ServiceUnavailable` with a non-sensitive message.
7. Validate the result contains exactly one item for every target, no extras or duplicates, normalized codes match the exact target set, and each value passes `RequireValue`. Invalid semantic output returns `422 UnprocessableEntity`.
8. Open `BeginTransactionAsync`.
9. Requery active languages inside the transaction and compare them with the pre-call set. Any difference returns `409 Conflict` and inserts nothing.
10. Create all `ResourceVersion` entities with one shared UTC timestamp, call `SaveChangesAsync` once, and commit once.
11. Catch `DbUpdateException`, roll back, clear added entities if needed, and return `409 Conflict` without provider details.
12. Return mapped `ResourceVersionResponse` objects in canonical target order.

The method must not hold a transaction or tracked database lock while waiting for OpenAI.

- [ ] **Step 7: Add the controller endpoint**

Add to `NavigationController`:

```csharp
[HttpPost("pages/{pageId:guid}/versions/{pageVersionId:guid}/resources/{resourceId:guid}/automatic-translations")]
public async Task<ActionResult<AutomaticTranslationsResponse>> GenerateAutomaticTranslations(
    Guid projectId,
    Guid pageId,
    Guid pageVersionId,
    Guid resourceId,
    [FromBody] GenerateAutomaticTranslationsRequest request,
    CancellationToken cancellationToken)
```

Follow the existing `TryGetUserId` and `NavigationException` pattern. Return:

```csharp
var created = await _navigationService.GenerateAutomaticTranslationsAsync(
    userId, projectId, pageId, pageVersionId, resourceId, request, cancellationToken);
return StatusCode(StatusCodes.Status201Created, created);
```

- [ ] **Step 8: Add invalid-output and all-or-nothing integration tests**

Add theories for provider results that are partial, duplicated, contain an extra code, contain an empty value, or contain an unsupported code. Expect `422` and verify the database still contains only the source.

Configure provider exceptions and assert `502` for invalid provider response and `503` for unavailable provider. Verify ProblemDetails never includes an API key, OpenAI response body, endpoint internals, or source text.

Add a conflict test using a fake that inserts a target translation through a separate scoped `AppDbContext` immediately before returning. Expect `409` and verify the operation does not add the other target. This proves the post-provider recheck and transaction behavior.

- [ ] **Step 9: Run focused and backend regression tests**

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj --filter AutomaticTranslations
dotnet test src/resources-api-test/resources-api-test.csproj
```

Expected: all automatic translation cases and the complete backend suite pass without a network call.

---

### Task 3: React automatic translation modal

**Files:**

- Modify: `src/resources-app/src/api.ts`
- Modify: `src/resources-app/src/App.tsx`
- Modify: `src/resources-app/src/App.css`
- Modify: `src/resources-app-test/App.integration.test.tsx`

**Interfaces:**

- Consumes: the `201 AutomaticTranslationsResponse` endpoint from Task 2.
- Produces: conditional **Añadir traducciones automáticas** action and a modal that submits one existing source language.

- [ ] **Step 1: Write the failing successful-flow integration test**

Extend the existing resource translation scenario so one `es-es` version exists and two languages are pending. Assert the automatic action is visible, open it, and verify:

```text
dialog accessible name: Añadir traducciones automáticas
source selector options: Español only
read-only source value: Hola
target list: Português (Brasil), English (United Kingdom)
primary action: Generar y guardar
secondary action: Cancelar
```

Mock the POST route, assert its body equals:

```json
{ "sourceLanguageCode": "es-es" }
```

Return `{ "translations": [...] }`, then assert the modal closes and all three translations render without refetching.

- [ ] **Step 2: Write failing visibility, loading, and error tests**

Add tests asserting:

- No automatic action while translations are loading.
- No automatic action when there are no active translations or no pending languages.
- With two existing translations, the source selector lists both and updates the read-only source value.
- A pending POST disables **Generar y guardar** and **Cancelar**, and a second click cannot send another request.
- A rejected POST keeps the modal open, preserves the source selection and current list, and renders the server message inside the dialog.

- [ ] **Step 3: Run focused frontend tests and verify red**

Run:

```bash
npm --prefix src/resources-app-test test -- --run App.integration.test.tsx
```

Expected: failures because the action, modal, and API function do not exist.

- [ ] **Step 4: Add frontend API types and POST function**

Add to `api.ts`:

```typescript
export type AutomaticTranslationsResponse = {
  translations: ResourceVersionResponse[]
}

export const postAutomaticTranslations = async (
  accessToken: string,
  projectId: string,
  pageId: string,
  pageVersionId: string,
  resourceId: string,
  sourceLanguageCode: string,
): Promise<AutomaticTranslationsResponse> => {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/v1/projects/${projectId}/pages/${pageId}/versions/${pageVersionId}/resources/${resourceId}/automatic-translations`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ sourceLanguageCode }),
    },
  )

  return parseResponse<AutomaticTranslationsResponse>(response)
}
```

- [ ] **Step 5: Add modal state and submit handler**

Add state local to `App`:

```typescript
const [isAutomaticTranslationsModalOpen, setIsAutomaticTranslationsModalOpen] = useState(false)
const [automaticTranslationSource, setAutomaticTranslationSource] = useState<SupportedLanguageCode>('es-es')
const [automaticTranslationsSubmitting, setAutomaticTranslationsSubmitting] = useState(false)
const [automaticTranslationsError, setAutomaticTranslationsError] = useState('')
```

Derive `selectedSourceVersion` from `resourceVersions` and the selected code. When opening, choose the first active version in the displayed list, clear modal error, and do not copy the source value into editable state.

Implement the handler with a synchronous double-submit guard:

```typescript
if (automaticTranslationsSubmitting) return
setAutomaticTranslationsSubmitting(true)
setAutomaticTranslationsError('')
try {
  const response = await postAutomaticTranslations(/* route IDs */, automaticTranslationSource)
  setResourceVersions((current) => [...response.translations, ...current])
  setIsAutomaticTranslationsModalOpen(false)
  setError('')
} catch (requestError) {
  setAutomaticTranslationsError(requestError instanceof Error ? requestError.message : 'Unknown error')
} finally {
  setAutomaticTranslationsSubmitting(false)
}
```

If React state alone cannot prevent two same-tick clicks in the test, add a `useRef(false)` request lock and reset it in `finally`; do not use `useMemo` or `useCallback` solely for this feature.

- [ ] **Step 6: Render the conditional action and complete modal**

Show **Añadir traducciones automáticas** only when:

```typescript
!resourceVersionsLoading && resourceVersions.length > 0 && availableLanguages.length > 0
```

The modal must contain:

- A source `<select>` made from existing `resourceVersions`, labelled `Idioma de origen`.
- The selected local flag, language label, and code.
- A read-only `<textarea>` labelled `Texto de origen` containing the selected version value.
- An uneditable list labelled `Idiomas de destino` made from `availableLanguages`.
- A primary button showing `Generando...` while pending.
- Disabled primary and cancel controls while pending.
- A `role="alert"` inside the dialog for `automaticTranslationsError`.

Reuse existing modal, language row, button, and list classes. Add CSS only for a stable read-only text area and target list if the existing rules do not render them clearly. Do not nest cards or expose API/provider details in UI copy.

- [ ] **Step 7: Run frontend tests, build, and lint**

Run:

```bash
npm --prefix src/resources-app-test test -- --run App.integration.test.tsx
npm --prefix src/resources-app run build
npm --prefix src/resources-app run lint
```

Expected: frontend integration tests, TypeScript build, Vite build, and oxlint pass.

---

### Task 4: Configuration documentation and end-to-end verification

**Files:**

- Modify: `README.md`
- Verify: `docs/05-automatic-translates/SPEC.md`
- Verify: `docs/funcional-spec.md`

**Interfaces:**

- Consumes: all backend and frontend deliverables.
- Produces: reproducible local setup and verified feature behavior.

- [ ] **Step 1: Document safe local configuration**

Add a concise README section with no real credential:

```bash
read -s "OPENAI_API_KEY?Nueva OpenAI API key: " && printf '\n' && \
printf '{"OpenAI:ApiKey":"%s"}' "$OPENAI_API_KEY" | \
dotnet user-secrets set --project src/resources-api/resources-api.csproj && \
unset OPENAI_API_KEY
```

Document that the value must be entered directly in the terminal, ChatGPT subscriptions do not include API credit, production must use its host secret manager, and `OpenAI:Model`, `OpenAI:TimeoutSeconds`, and `OpenAI:MaxOutputTokens` are non-secret settings. State that exposed keys must be revoked immediately.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
dotnet test src/resources-api-test/resources-api-test.csproj
npm --prefix src/resources-app-test test
npm run build
npm run lint
git diff --check
```

Expected: all backend and frontend tests pass, both applications build, lint passes, and `git diff --check` prints no errors.

- [ ] **Step 3: Run one opt-in OpenAI smoke test**

Start the API with the configured User Secret and invoke one resource that has exactly one source and pending targets. Verify:

- The endpoint returns `201` with exactly the pending languages.
- A following GET returns the source plus every generated translation.
- OpenAI dashboard usage increases for the configured project.
- Server output does not contain the API key, source text, generated text, request body, or response body.

This is a manual opt-in check and must never be part of `dotnet test` or CI because it consumes paid credit and is nondeterministic.

- [ ] **Step 4: Validate the browser workflow at desktop and mobile widths**

With the local app open, verify at one desktop viewport and one mobile viewport:

- The automatic button appears only with at least one source and one pending language.
- Modal text, flags, selectors, target list, and buttons do not overlap or overflow.
- Pending state prevents duplicate interaction.
- Success adds translations and removes the automatic action when no targets remain.
- Failure keeps the modal and prior list intact.
- Manual **Añadir traducción** still works.

- [ ] **Step 5: Final security and scope review**

Run searches that print only matching file names, never secret values:

```bash
git grep -l "OpenAI:ApiKey" -- ':!README.md' ':!docs/**'
git grep -l "sk-proj-" -- .
git diff --name-only
```

Expected: the key name appears only where configuration is read, no actual key prefix is tracked, and changed files match this plan. Confirm no migration, OpenAI SDK, Azure resource, agent, conversation, tool, retry loop, or frontend credential was added.

## Acceptance Matrix

| Requirement | Covered by |
| --- | --- |
| Source selected from existing translations | Task 2 Steps 2/6; Task 3 Steps 1/5/6 |
| API determines all pending targets | Task 2 Steps 5/6 |
| OpenAI Responses API with strict output | Task 1 Steps 1/4/5 |
| No conversation, tools, or provider storage | Task 1 Steps 1/4 |
| Immediate all-or-nothing persistence | Task 2 Steps 6/8 |
| Concurrent change returns conflict | Task 2 Steps 6/8 |
| No provider calls for invalid access/input | Task 2 Step 2 |
| Browser never receives the API key | Global constraints; Task 3; Task 4 Step 5 |
| No paid calls in automated tests | Global constraints; Tasks 1/2; Task 4 Step 3 |
| Modal success, pending, and failure behavior | Task 3 Steps 1/2/5/6 |
| Backend/frontend regression coverage | Tasks 1/2/3 and Task 4 Step 2 |