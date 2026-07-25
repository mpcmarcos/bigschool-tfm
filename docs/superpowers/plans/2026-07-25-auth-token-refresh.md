# Auth Token Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renew an expired access token after an authenticated request returns 401, retry that request once, and return the user to login when renewal fails.

**Architecture:** `api.ts` owns an authenticated fetch wrapper and coordinates a single in-flight refresh for concurrent 401 responses. `App.tsx` supplies the session refresh callback, persists rotated tokens, and clears invalid sessions so the existing route guard redirects to `/login`.

**Tech Stack:** React 19, TypeScript, Fetch API, Vitest, Testing Library

## Global Constraints

- Retry an authenticated request at most once.
- Never refresh public login, refresh, health, or echo requests.
- Reuse one refresh operation when concurrent requests fail with 401.
- Persist every rotated access and refresh token in `resources-auth-session`.
- Clear the local session and return to `/login` when refresh fails.
- Add no new runtime dependencies.

---

### Task 1: Token renewal and request retry

**Files:**
- Modify: `src/resources-app-test/App.integration.test.tsx`
- Modify: `src/resources-app/src/api.ts`
- Modify: `src/resources-app/src/App.tsx`

**Interfaces:**
- Produces: `configureAuthRefresh(handler: AuthRefreshHandler | null): void`
- Produces: `postRefresh(refreshToken: string): Promise<AuthResponse>`
- Consumes: existing `AuthResponse` and authenticated API functions.

- [ ] **Step 1: Write a failing integration test**

Add a test where the first projects request returns 401, `/api/v1/auth/refresh` returns rotated tokens, and the retried projects request succeeds with the new bearer token. Assert that the project renders and `localStorage` contains both rotated tokens.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run App.integration.test.tsx -t "refreshes an expired access token"`

Expected: FAIL because no refresh request is made and the project is not rendered.

- [ ] **Step 3: Implement minimal centralized renewal**

In `api.ts`, add `postRefresh`, a configurable refresh handler, a shared in-flight refresh promise, and an authenticated fetch wrapper that retries once. Route every bearer-authenticated API function through that wrapper.

In `App.tsx`, configure the handler to use the latest session, persist the returned `AuthResponse`, and return its access token to the wrapper.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run App.integration.test.tsx -t "refreshes an expired access token"`

Expected: PASS.

### Task 2: Invalid refresh returns to login

**Files:**
- Modify: `src/resources-app-test/App.integration.test.tsx`
- Modify: `src/resources-app/src/App.tsx`

**Interfaces:**
- Consumes: `configureAuthRefresh(handler: AuthRefreshHandler | null): void`.
- Produces: invalid-session cleanup through the existing `session === null` route guard.

- [ ] **Step 1: Write a failing integration test**

Add a test where the projects request and refresh request both return 401. Assert that `/login` is rendered and `resources-auth-session` is removed.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run App.integration.test.tsx -t "returns to login when token refresh fails"`

Expected: FAIL while the stale session remains active.

- [ ] **Step 3: Implement invalid-session cleanup**

Catch refresh errors in the configured handler, clear the current session reference, remove local storage, reset session state, and return `null` so the original response is not retried.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- --run App.integration.test.tsx -t "returns to login when token refresh fails"`

Expected: PASS.

### Task 3: Regression verification

**Files:**
- Verify: `src/resources-app/src/api.ts`
- Verify: `src/resources-app/src/App.tsx`
- Verify: `src/resources-app-test/App.integration.test.tsx`

- [ ] **Step 1: Run the complete frontend integration suite**

Run from `src/resources-app-test`: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Build the frontend**

Run from `src/resources-app`: `npm run build`

Expected: TypeScript and Vite finish with exit code 0.

- [ ] **Step 3: Lint the frontend**

Run from `src/resources-app`: `npm run lint`

Expected: oxlint reports no errors.