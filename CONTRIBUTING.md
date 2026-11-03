# Contributing to the template

This file is for maintainers of the template itself; `init` deletes it from every project.

## Setup

Run `git config core.hooksPath .githooks` once in your clone. `init` sets it for the projects it
creates, but a clone of the template does not get it automatically, and without it the pre-commit
hook never runs.

Check every change with `node scripts/verify.mjs` (`--quick` while iterating). The template CI
(`.github/workflows/template-ci.yml`) runs three jobs that must all stay green:

- `as-shipped` — `verify` on the template as it is;
- `skeleton` — `node scripts/remove-sample.mjs`, then `verify`, so the tree without the sample builds;
- `initialized` — `init` with dummy answers (`acme-orders`, `com.acme.orders`), then `verify`.

## Rules for template content

- **Placeholders only.** The names a project replaces are exactly `io.scaffold.starter` (and its path
  `io/scaffold/starter`), `scaffold-starter`, `scaffold_starter` and `Scaffold Starter`. Any other
  spelling of the template's name must stay out of every file that survives `init`, vendored skill
  folders excepted; `scripts/init.test.mjs` fails otherwise. Files `init` deletes (this one,
  `README.md`, `docs/superpowers/`, `scripts/init*.mjs`, `scripts/release-tag*.mjs`,
  `template-ci.yml`, `release-tag.yml`) are free to use it.
- **Placeholder lines must survive the longest names.** `init` rewrites without reformatting, and
  a display name may be 60 characters. In the frontend, reference `APP_NAME`
  (`frontend/src/app/shared/app-name/app-name.ts`) instead of writing the display name again; a
  literal that remains (`index.html`) must stay well under the 100-column print width with 60
  characters substituted. `init.test.mjs` runs Prettier over a project initialized with the longest
  valid names.
- **Docs `init` keeps must not cite files it deletes.** `README.project.md` becomes the project's
  `README.md`; an `AGENTS.md` that backticks a deleted path fails `check-agent-docs` in the
  `initialized` job.
- **Sample files are hashed.** Editing any file in `SAMPLE_FILES` (`scripts/remove-sample.mjs`)
  needs `node scripts/remove-sample.mjs --refresh-hashes` in the same commit; otherwise the hash test
  fails, and in a project `remove-sample` would refuse the unedited sample as drifted. Lines that
  only exist for the sample in shared files end with the `sample:catalog` marker.
- **Vendored skills stay verbatim.** They are pinned in `skills-lock.json` (source, ref, and a
  hash of the whole folder, so `check-agent-docs` fails on an edit to any file of one); an update
  replaces the folder from the new upstream ref, deletes the files `THIRD_PARTY_LICENSES.md` lists
  as left out (files may be dropped, never edited), records the ref, re-pins the hash with
  `node scripts/check-agent-docs.mjs --refresh-hashes` in the same commit, and refreshes the
  licence text in `THIRD_PARTY_LICENSES.md`.

## Lessons flow back by hand

When a project built from the template teaches something, the template learns it as a fresh change
written here: never copied code, domain names, data or history from the project. Restate the lesson
in the template's own terms (the `catalog` sample, the placeholder names), with a test where the
template can carry one, and say why in the commit message.

Projects never pull from the template; there is no link back. A project porting an improvement
reads the template's commits after the tag named in its initial commit message and applies them by
hand.

## Releasing

1. Set `TEMPLATE_VERSION` in `scripts/init.mjs` to the new version.
2. Once the version is complete and CI is green on `main`, run the release-tag workflow from the
   Actions tab (**Run workflow** on `main`). It never runs on its own, because the version bump
   lands on `main` before the version's last changes do. `.github/workflows/release-tag.yml` checks
   that `ci` and `template-ci` both succeeded for the push of `main`'s tip, then
   `scripts/release-tag.mjs` creates the annotated tag `vX.Y.Z` (from `TEMPLATE_VERSION`, message
   `vX.Y.Z`) on it as `github-actions[bot]` and pushes it. It fails when either workflow has not
   succeeded for that commit, and leaves an existing `vX.Y.Z` alone. Fallback, if the workflow cannot run: tag the commit and push the tag yourself,
   `git tag -a vX.Y.Z -m "vX.Y.Z" <commit>` and `git push origin vX.Y.Z`.

This workflow is release automation, not a CI wrapper: wrappers run `verify` and nothing else,
while this one runs no checks of its own and only reads the other two workflows' results.

Versions follow semver as seen from a project: a minor version adds or changes what new projects
get; a patch fixes the template without changing what a project should port.
