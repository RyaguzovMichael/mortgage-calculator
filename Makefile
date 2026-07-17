# Mortgage calculator — task runner.
#
# Targets are wired through prerequisites so the "safe" path (run) is gated:
#   run  ->  build  ->  test  ->  install
# Asking for `make run` therefore always installs deps, runs the unit tests,
# type-checks and produces an optimized production build, and only then serves
# that build. `make dev` is the fast, unguarded loop with none of these gates.

# Use pnpm as configured in package.json (packageManager: pnpm@10.x).
PNPM := pnpm

.DEFAULT_GOAL := run

.PHONY: run dev test type-check build install lint format clean

## run: full guarded pipeline — install, test, build, then serve the production build.
run: build
	$(PNPM) preview

## dev: fast unguarded dev server with HMR; no tests, no build, no install gate.
dev:
	$(PNPM) dev

## test: run the unit test suite once (non-watch), as a build gate.
test: install
	$(PNPM) test:unit --run

## type-check: vue-tsc type checking only, no emit.
type-check: install
	$(PNPM) type-check

## build: type-check and produce the optimized production bundle in dist/.
build: test type-check
	$(PNPM) build

## install: install dependencies (skipped automatically when up to date by pnpm).
install:
	$(PNPM) install

## lint: oxlint then eslint, both with --fix.
lint: install
	$(PNPM) lint

## format: prettier over src/.
format: install
	$(PNPM) format

## clean: remove build output.
clean:
	rm -rf dist
