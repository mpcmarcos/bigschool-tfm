# Page Edit And Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page editing and soft deletion to the project page list.

**Architecture:** The API client adds authenticated PUT and DELETE operations. `App` follows the existing project action pattern with separate edit and confirmation modals, updating the local page collection after successful responses.

**Tech Stack:** React 19, TypeScript, Fetch API, Vitest, Testing Library

## Global Constraints

- Keep the existing hierarchical routes unchanged.
- Require a non-empty page name before sending an update.
- Confirm deletion before calling the API.
- Reuse the authenticated fetch wrapper and existing modal styles.
- Add no runtime dependencies.

---

### Task 1: Page edit and delete flow

**Files:**
- Modify: `src/resources-app-test/App.integration.test.tsx`
- Modify: `src/resources-app/src/api.ts`
- Modify: `src/resources-app/src/App.tsx`
- Modify: `docs/04-feature-navigation/SPEC.md`

**Interfaces:**
- Produces: `putPage(accessToken, projectId, pageId, payload): Promise<PageResponse>`
- Produces: `deletePage(accessToken, projectId, pageId): Promise<void>`

- [ ] **Step 1: Write the failing integration test**

Add a page-list test that edits a page through the modal, asserts the PUT payload and updated card, then opens delete confirmation, confirms it, asserts DELETE and verifies the card disappears.

- [ ] **Step 2: Run the focused test and verify RED**

Run from `src/resources-app-test`: `npm test -- --run App.integration.test.tsx -t "edits and deletes a page"`.

Expected: failure because the `Editar` and `Borrar` page actions are absent.

- [ ] **Step 3: Implement the API and UI behavior**

Add authenticated PUT/DELETE functions to `api.ts`. Add edit/delete state, handlers, card actions and separate modals to `App.tsx`; replace the updated page and filter the deleted page after success.

- [ ] **Step 4: Document the detailed interaction**

Extend `docs/04-feature-navigation/SPEC.md` with the action labels, modal fields, required-name validation, confirmation requirement and visible-list behavior after soft deletion.

- [ ] **Step 5: Verify the focused and full frontend checks**

Run the focused test, all frontend integration tests, `npm run build`, `npm run lint`, and `git diff --check`. All commands must exit successfully.