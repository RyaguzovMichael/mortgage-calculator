# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page Vue 3 + TypeScript app that compares ways of buying an apartment in Kazakhstan (Halyk mortgage, Otbasy state housing loan, or saving up and paying cash), month by month, and reports which leaves you best off. Most comments are in Russian; UI text is translated (Russian/English) via `vue-i18n` — see `src/i18n/`. There is no backend — everything runs client-side and inputs persist to `localStorage`.

## MODEL.md is the source of truth

`MODEL.md` (Russian) is the specification for the domain: inputs, the four built-in plans, every rate convention, and the assumptions. **The engine must match MODEL.md — on a discrepancy, fix the code, not the doc.** Before changing any calculation in `src/engine/`, read the relevant MODEL.md section; the comments in the engine cross-reference it heavily. If a change alters the model's behaviour deliberately, update MODEL.md in the same change.

## Commands

Uses `pnpm` (see `packageManager` in package.json). A `Makefile` wraps the common flows:

- `make dev` / `pnpm dev` — fast Vite dev server with HMR, no gates.
- `make run` — guarded pipeline: install → test → type-check → build → serve the production build. Slow; use `dev` while working.
- `pnpm test:unit` — Vitest in watch mode. `pnpm test:unit --run` for a single non-watch pass. Run one file with `pnpm test:unit --run src/__tests__/simulate.spec.ts`, or one case with `-t "substring of the it() name"`.
- `pnpm type-check` — `vue-tsc`, no emit. Strict mode plus `noUncheckedIndexedAccess`.
- `pnpm lint` — oxlint then eslint, both `--fix`. `pnpm format` — prettier over `src/` (no semicolons, single quotes, width 100).

`@/` is an alias for `src/` (configured in both `vite.config.ts` and `vitest.config.ts`).

## Architecture

Strict one-directional layering. Inner layers never import outward.

**`src/engine/`** — pure TypeScript, no Vue, no I/O. Given a plain `Inputs` object it computes results. `simulateAll(inputs, builtInPlans)` in `simulate.ts` is the single entry point the UI calls. The built-in plans are *passed in* rather than imported, because the engine may not reach across its boundary into `infrastructure/`.
  - `runPlan.ts` is one driver for **every** plan — what used to be four near-duplicate variant files. A plan is four decisions (`loan`, `buyWhen`, `borrow`, `repay` — see `types/plan.ts`); the month loop, rent, and loan servicing are identical and live here once. The differences are read off the plan.
  - Primitives: `loan.ts`, `deposit.ts`, `otbasyAccount.ts`, `wallet.ts`, `money.ts`. These are closures with getters, not classes.
  - `types/inputs.ts` holds `Inputs` and the derived-quantity functions (`targetLoan`, `apartmentPriceAt`, `rentDueAt`, …). This is where model formulas live as functions.
  - `variants/months.ts` is a generator yielding one already-accrued `MonthContext` per month; `variants/shared.ts` holds the row-building and payment helpers `runPlan` uses.

**`src/infrastructure/`** — the boundary to persisted and shipped data. `data/deposits.yml` and `data/plans.yml` are parsed here (via `@modyfi/vite-plugin-yaml`, which turns them into modules at build time). `inputsStorage.ts` owns `DEFAULT_INPUTS`, the `STORAGE_KEY`, and load/save. `localePersistence.ts` and `themePersistence.ts` are the same shape, scaled down for a single stored string each.

**`src/app/`** — `useInputs.ts` is a module-level reactive `Inputs` tree plus a `computed` report; a plain composable, not a store (one page, one model). `useFormat.ts` renders numbers (locale-invariant) and translatable text (deposit/plan descriptions, phase labels) via `useI18n()` — the label `Record`s it returns are `computed`, not plain objects, so a locale switch doesn't leave them frozen at whatever language was active on mount. `useTheme.ts` and `useLocale.ts` are the reactive+persistence pair for the navbar's theme and language toggles.

**`src/i18n/`** — `vue-i18n` setup (`legacy: false`, Composition API mode) and `locales/{ru,en}.json`, namespaced by component. A new UI string needs a key in both files.

**`src/components/` + `src/views/`** — Vue SFCs. `CalculatorView.vue` is the whole page: inputs panel on the left, summary + chart/schedule on the right. Inputs are split into tab components under `components/inputs/`. `NavBar.vue` (mounted once, in `App.vue`, above `RouterView`) holds the brand, the placeholder nav button, and the locale/theme switchers.

### Invariants worth knowing before editing

- **Built-in deposits and plans are never persisted.** `saveInputs` strips them; `loadInputs` re-adds them from the YAML. "Built-in" is defined as membership in the file (`isBuiltInProduct` / `isBuiltInPlan`), not a stored flag — so editing the file reaches users who already have saved data, and a deleted entry actually disappears. Only the user's *own* deposits/plans and their board-visibility choices live in `localStorage`.
- **Bump `STORAGE_KEY`** (`inputsStorage.ts`) whenever the `Inputs` shape changes. `repair()` merges a stored blob field-by-field against `DEFAULT_INPUTS` as a schema, so a single bad field costs only that field — but a real shape change still needs the bump. Tests import `STORAGE_KEY` rather than hard-coding it.
- **The engine must receive plain objects, never Vue proxies.** `useInputs.ts` calls `toPlain()` (JSON round-trip) before every `simulateAll`; the engine reads each value many times per run and a proxy would tax every read.
- **Two rate conventions in `money.ts`, do not mix them.** Bank rates (`monthlyRate`) are nominal-annual compounded monthly. Real-world growth — apartment price, rent — uses `annualGrowthFactor`, which steps in half-years and is *not* compounded monthly (compounding a stated annual "up 24%" would silently restate it as 26.82%).
- **The comparison window is not the horizon.** `simulateAll` cuts every shown variant back to the month the slowest one clears its debt (`comparisonWindow`). The board shows **≤ 8 plans** (one per palette slot, `MAX_SHOWN`), and the "best" variant and window are computed over the *shown* plans only.
- Data files (`data/*.yml`) are validated strictly at parse time and **throw** on a bad entry — this is shipped data, so a typo should stop the app at startup rather than silently compute at a rate nobody chose.

## Tests

Vitest with jsdom, all under `src/__tests__/`. `regression.spec.ts` pins the ported arithmetic against the original Python prototype at the component level (whole-variant results deliberately differ — the prototype was structurally wrong). When changing engine maths, expect `variants.spec.ts` and `simulate.spec.ts` to be the sensitive ones.
