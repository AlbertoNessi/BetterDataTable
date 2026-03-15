# AGENTS.md
This file is the repository-specific guide for agentic coding tools.
Use it as the main instruction source for this repo.

## Scope
- Project type: source-first JavaScript data-table library with a Symfony 5 example app.
- Main runtime: Node.js with native ES modules.
- Main code: `src/`.
- Tests: `test/`.
- Demo assets: `examples/`, `styles/`, `scripts/serve.mjs`.
- PHP example: `symfony5-integration/`.

## Rule Files Discovered
- No prior root `AGENTS.md` existed.
- No `.cursorrules` file was found.
- No files were found under `.cursor/rules/`.
- No `.github/copilot-instructions.md` file was found.
- Until such files are added, follow this file and existing repository patterns.

## Repository Map
- `src/index.js`: public JS entry point.
- `src/core/BetterDataTable.js`: primary class and DOM/lifecycle logic.
- `src/core/QueryEngine.js`: pure filter/sort/paginate logic.
- `src/core/StateStore.js`, `src/core/EventBus.js`, `src/core/utils.js`: support modules.
- `src/adapters/jquery.js`: jQuery compatibility adapter.
- `test/*.test.js`: Node test coverage, mostly with JSDOM.
- `symfony5-integration/`: PHP fixture app used by compatibility tests.

## Install
- Root deps: `npm install`
- Symfony example deps if needed: run `composer install` inside `symfony5-integration/`

## Build, Lint, And Test Commands
### Root Commands
- Run all tests: `npm test`
- Direct equivalent: `node --test`
- Run one test file: `node --test test/query-engine.test.js`
- Run one named test: `node --test --test-name-pattern="stable" test/query-engine.test.js`
- Run matching tests across files: `node --test --test-name-pattern="Symfony"`
- Start the demo server: `npm run demo`
- Start demo server on a custom port: `node scripts/serve.mjs 4174`

### Current Repo Reality
- There is no root build script in `package.json`.
- There is no root lint script or lint config.
- Do not invent a bundler, formatter, or lint workflow unless the user asks.
- The current quality gate is the test suite.
- Prefer direct `node --test` commands when you need precise targeting.

### Single-Test Guidance
- Narrow failures by file first: `node --test test/jquery-compat.test.js`
- Then narrow by case name with `--test-name-pattern`.
- Combine both when needed: `node --test --test-name-pattern="replaceChildren" test/browser-compat.test.js`
- If you change Symfony integration or server mode behavior, run `test/symfony5-compat.test.js` before the full suite.

### Symfony Example Helpers
- From `symfony5-integration/`, probe the page: `php tools/request.php /`
- From `symfony5-integration/`, probe the JSON API: `php tools/request.php /api/players`
- These are debugging helpers; `npm test` already exercises them.

## Verified State
- `npm test` currently passes.
- `node --test test/query-engine.test.js` currently passes.
- `node --test --test-name-pattern="stable" test/query-engine.test.js` currently passes.

## Tech Stack Assumptions
- JavaScript only in the main library; no TypeScript.
- Native ES modules are required (`"type": "module"`).
- Relative imports use explicit `.js` extensions.
- Tests use `node:test` and `node:assert/strict`.
- DOM tests use `jsdom`.
- Package exports point at source files directly; there is no transpile/build step.

## Code Style Guidelines
### Formatting
- JavaScript uses 2-space indentation, double quotes, and semicolons.
- Existing Symfony PHP files use 4-space indentation and `declare(strict_types=1);`.
- Keep lines readable; split long objects, arrays, and call sites across multiple lines.
- Omit trailing commas to match the current JS style.
- Use blank lines between logical blocks, not after every statement.

### Imports And Exports
- Keep imports at the top of the file.
- Prefer named imports and named exports.
- Use relative imports with explicit `.js` suffixes.
- Keep import order stable and simple; there is no enforced sorter.
- Re-export public helpers deliberately, not through unnecessary indirection.

### Naming
- Use `PascalCase` for classes.
- Use `camelCase` for functions, methods, variables, local helpers, and option keys.
- Use `UPPER_SNAKE_CASE` for file-level constants such as `DEFAULT_OPTIONS`.
- Use descriptive state names like `pageRows`, `filteredCount`, and `scrollTop`.
- Private class methods should use `#camelCase`.
- Preserve the BEM-like CSS naming scheme: `bdt__element--modifier`.

### Types And Data Shapes
- There is no static type layer, so keep APIs explicit through naming, defaults, and tests.
- Normalize inputs early, especially options, accessors, and config objects.
- Preserve stable shapes for state, event payloads, and server query results.
- In PHP files, keep typed return declarations and array-shape docblocks where they add real value.

### JavaScript Patterns
- Prefer `const`; use `let` only when reassignment is required.
- Prefer early returns over nested conditionals.
- Keep pure logic separate from DOM manipulation when possible.
- Use focused helpers for repeated normalization or transformation logic.
- Preserve public API behavior unless the user asks for a breaking change.

### DOM And Rendering
- Build UI with `document.createElement`, not HTML strings, unless there is a strong reason.
- Prefer `textContent` for values shown in the table.
- Use `DocumentFragment` and one-shot replacement for larger redraws.
- Prefer delegated event handling for row/cell content that is re-rendered.
- Preserve accessibility behavior: ARIA labels, keyboard navigation, and live-region announcements.

### Error Handling
- Throw `Error` for invalid public usage or impossible required inputs.
- Catch at recovery boundaries and fall back to safe behavior.
- Emit table `error` events for render/query/security failures instead of crashing the whole table.
- Swallow errors only when failure is intentionally non-fatal, such as storage access.
- Make failure messages direct and actionable.

### Security
- Keep rendering secure by default.
- Prefer renderer outputs shaped like `{ text }`.
- Only allow `{ html }` when `security.allowUnsafeHtml` is enabled.
- If raw HTML is enabled, respect `security.sanitizer`.
- Do not add new `innerHTML` usage without equivalent safeguards.

### Testing
- Add or update tests for behavior changes.
- Keep test names descriptive and sentence-like.
- Use `node:test` and `node:assert/strict` in JS tests.
- Reuse the existing JSDOM setup style for DOM tests.
- Prefer small targeted tests over broad scenario tests.
- When fixing a regression, add the failing case if practical.

### Performance And Lifecycle
- Keep `QueryEngine` pure and DOM-free.
- Be careful inside render paths, scroll handlers, and server-query flows.
- Preserve batched rendering through `requestAnimationFrame` unless lifecycle semantics must change.
- Avoid unnecessary DOM churn; replace content in bulk where practical.
- Keep cleanup order deliberate in `destroy()` and listener teardown.

### Comments And Docs
- Match the existing comment style: short, purposeful, and only for non-obvious behavior.
- Prefer comments that explain invariants, safety constraints, or sequencing requirements.
- Avoid decorative comments.
- Update `README.md` when public behavior or contributor workflow materially changes.

## File-Specific Guidance
- If you change `src/core/BetterDataTable.js`, verify DOM behavior and lifecycle semantics.
- If you change `src/core/QueryEngine.js`, run `node --test test/query-engine.test.js`.
- If you change `src/adapters/jquery.js`, run `node --test test/jquery-compat.test.js`.
- If you change compatibility helpers, run `node --test test/browser-compat.test.js`.
- If you change Symfony example behavior or server-mode expectations, run `node --test test/symfony5-compat.test.js`.
- When changes span multiple modules, finish with `npm test`.

## Agent Expectations
- Respect uncommitted user changes; do not revert unrelated work.
- Prefer minimal, surgical edits over broad refactors.
- Preserve the current source-first packaging model unless asked otherwise.
- Follow the repository's existing style even when no tool enforces it.
- If Cursor or Copilot rule files appear later, merge their repo-specific guidance into this document.
