# Country databases

The app is multi-country. Each country ships its own "database" — the deposit
and loan catalogues, the currency symbol, the programme flags (today: Otbasy) and
a few economic starting numbers — but everything runs client-side, so the
"database" is just YAML files served as static assets. There is no backend and
there never will be one for this feature.

## Layout

```
public/db/<code>/meta.yml      ← identity + flags + defaults
public/db/<code>/deposits.yml  ← built-in deposits (same shape as always)
public/db/<code>/loans.yml     ← built-in loans; the `otbasy` entry is the one
                                  reserved id and is required iff meta.otbasy is true
```

`<code>` is the folder name and the meta `code` field — both must be the same
lower-case ISO 3166-1 alpha-2 code. The **folder list is the country list**:
`build/countries.mjs` scans `public/db/` at build time, validates every folder
(meta parses, code matches the folder, names present for ru/en, currency symbol
present, `otbasy` boolean, `defaults` numeric, `deposits.yml`/`loans.yml` exist),
and inlines the result as `__DB_COUNTRIES__`. An invalid folder **fails the
build**; nothing is half-validated at runtime.

## meta.yml

```yaml
code: kz
name: { ru: Казахстан, en: Kazakhstan }
currencySymbol: ₸          # substituted everywhere the UI shows money
otbasy: true               # whether the Otbasy programme exists here
defaults:                  # economic starting points for a fresh install
  horizonMonths: 60
  apartmentAnnualGrowthRate: 0.05
  annualIndexationRate: 0.05
  raiseMonth: 6
example:                   # optional; personal numbers for the wizard's
  annualIndexationRate: 0  # "Посмотреть пример" button. Absent → button hidden.
  monthlySalary: 1000000
  ...
```

Personal data (flat, salary, savings…) belongs only in `example`, never in
`defaults` — `defaults` is shared by every user of the country and is used for
a brand-new install before the wizard runs.

The calculation start date is always **today**, never a configured date.

## Runtime flow

1. `main.ts` reads the stored choice (`mortgage:country:v1`).
2. No choice (or a code that no longer exists in `__DB_COUNTRIES__`) →
   `CountryGate.vue` asks; picking stores the code and reloads.
3. Otherwise `infrastructure/countryDb.ts` fetches `{base}db/<code>/{deposits,loans}.yml`
   (base respects `VITE_BASE_PATH`, which is what makes this work on GitHub Pages),
   parses and validates them with the same strict parsers the rest of the app
   uses, and hands them to `setCurrentCountry()`.
4. Only then are the inputs bootstrapped (`initInputs()`), the router created,
   and the app mounted. A failed fetch shows a retry screen — the app never
   silently falls back to another country's numbers.

The built-in catalogues (`BUILT_IN_PRODUCTS`, `BUILT_IN_LOAN_PRODUCTS`, …) are
no longer module constants: they are set once at boot and read afterwards.

## Per-country storage

Everything personal is namespaced by country code:

| key                             | contents                          |
| ------------------------------- | --------------------------------- |
| `mortgage:inputs:<code>:v16`    | the user's inputs blob            |
| `mortgage:onboarded:<code>:v1`  | wizard finished for this country  |
| `mortgage:wizard-step:<code>:v1`| wizard resume position            |

Locale and theme stay global (`mortgage:locale:v1`, `mortgage:theme:v1`).
Switching country reloads the page; the new country's blob (or a blank start)
loads, its wizard, board and data are fully separate, and switching back
restores the previous state byte-for-byte. `localStorage` from before the
multi-country change (`mortgage:inputs:v16`) is ignored, not migrated.

## Adding a country

1. `mkdir public/db/xx`, add `meta.yml`, `deposits.yml`, `loans.yml`.
2. If the country has no Otbasy equivalent: `otbasy: false` and no `otbasy`
   entry in `loans.yml`. The UI then hides the programme everywhere and the
   generator produces no Otbasy plans. (Kazakhstan is the only `otbasy: true`
   country today.)
3. `pnpm build` — the folder is picked up automatically; nothing else to register.
4. Deploy. Users pick the country on first visit or from the navbar.

There is deliberately no "edit in production" path: countries ship with the
site, in the repo, reviewed like code.
