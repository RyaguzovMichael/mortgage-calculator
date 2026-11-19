# Extension idea (not implemented): per-country JS plugins for special programmes

> Status: **deferred**. Otbasy is currently hard-coded into the engine, switched
> per country by the `meta.otbasy` flag. This document records the direction we
> may take later, and why it is not done yet.

## The idea

Some countries have state programmes as sui generis as Otbasy (Kazakhstan's
programme with its deposit gates and CC requirement) — things that cannot be
expressed as "rate + term + down payment" like an ordinary `LoanProduct`, and
not worth one engine feature per programme forever.

The sketch: `meta.yml` gains a list of extension scripts,

```yaml
extensions:
  - otbasy.js
```

shipped in the same `public/db/<code>/` folder, loaded at bootstrap with a
dynamic `import()`, each exporting a plugin object. The plugin registers a
special loan programme with the engine: its gates, its monthly mechanics
(like `createOtbasyAccount` today), its UI section (fields, wizard steps,
plan-loan option) via declared hooks.

## Why not yet

- **The engine is not ready.** Otbasy is woven through `runPlan`, `wallet`,
  `simulate`, `bestPlans` and the UI as a special case. A plugin API designed
  before that seam is cut would be a plugin API for exactly one programme,
  which is the wrong shape. Step 1 of any real implementation is refactoring
  Otbasy itself behind a proper "programme" interface.
- **The contract is the hard part.** Plugins would need: per-month hooks
  (observe/advance state), purchase gating, savings routing, UI injection,
  and plan serialisation — all versioned, all debuggable across releases. That
  is a product, not a flag.
- **Trust model.** Plugins are same-origin JS with full app privileges. That is
  fine for data we author ourselves and review in the repo — but it rules out
  third-party/community plugins without a sandbox, which is a separate project.
- **Cheaper first step.** Every programme anyone has asked for so far is
  either an ordinary `LoanProduct` (most state mortgages are: subsidised rate +
  cap) or Otbasy verbatim (which exists). Declarative `LoanProduct` entries
  plus the `otbasy` flag cover them.

## What to do when it becomes real

1. Extract the Otbasy programme out of the engine into `src/engine/programmes/otbasy.ts`
   implementing a `LoanProgramme` interface; the engine keeps only the interface.
2. Move the Otbasy UI sections behind a registry keyed off that interface
   (inputs tab section, wizard step, plan option, loan description).
3. Then — and only then — define the plugin manifest and `extensions:` in
   `meta.yml`, loaded with `import()`, with a semver'd plugin API.
4. Documentation and an example plugin go in `docs/` next to
   `docs/countries.md`.
