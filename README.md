# Mortgage Calculation

A single-page app for comparing different ways of buying a home over time — mortgage,
subsidized/state loan programs, saving up and paying cash, or any other repayment
strategy you can describe as a plan — month by month, to see which one leaves you
best off.

There is no backend: everything runs client-side, and your inputs are kept only in
your browser's local storage.

> **This is not financial advice.** The numbers here are for personal, informational
> exploration only. They rely on assumptions and simplifications you provide or that
> are built into the model — always verify real terms with your bank, lender, or a
> qualified financial advisor before making any decision.

## Status

The calculator currently ships with a fixed set of banks, programs, and rate
conventions. The goal going forward is to make it **agnostic and configurable** —
so that deposits, loan programs, taxes, and growth assumptions for any country, city,
or bank can be set up rather than hard-coded. Contributions and ideas toward that
direction are welcome.

## Development

Uses `pnpm`. See `CLAUDE.md` for architecture notes if you're diving into the code.

```sh
pnpm install
pnpm dev          # start the dev server
pnpm test:unit    # run tests
pnpm type-check   # type-check
pnpm lint         # lint
```

`make run` runs the full guarded pipeline (install → test → type-check → build → serve).

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) — Copyright (c) 2026 Ryaguzov Michael.
Free to use, modify, and self-host for noncommercial purposes. Commercial use is not
permitted without the author's permission.
