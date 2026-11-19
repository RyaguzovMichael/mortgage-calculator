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

The calculator is **multi-country**: each country ships its own deposits/loans
catalogues, currency and programme flags as static files under `public/db/<code>/`,
validated at build time and fetched when you pick the country (on first visit, or
any time from the navbar). Kazakhstan ships today; adding another country is a
folder, not a fork — see [docs/countries.md](docs/countries.md). Your data is
stored per country, so switching back and forth loses nothing.

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
