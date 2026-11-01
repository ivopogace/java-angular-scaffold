---
name: docs-freshness
description: >-
  Staleness audit of the agent-facing docs (the three AGENTS.md files, this repo's own skills,
  ADRs, GLOSSARY.md, docs/agents/workflow.md, and prose in source such as package-info.java,
  Javadoc, TSDoc and test names) against a git range. Load before finishing a branch that
  renames, moves or removes something a doc states, after removing the sample, or when asked
  whether the docs are still true. A single changed doc line in a review is `review-checklist`
  RC-DOC-1; changing the glossary or an ADR's decision is `domain-modeling`'s.
---

# Docs freshness

Finds present-tense statements a change made false. It verifies; it does not add documentation.
`node scripts/check-agent-docs.mjs` (part of `verify`) already fails on a backticked path in an
`AGENTS.md` that does not exist, a skill missing from the *Skills* table and a malformed skill
frontmatter — this audit covers everything that check cannot read: prose. Full worked example
of what the docs describe: the `catalog` sample, while it exists.

## Range

A branch's own diff: `git diff $(git merge-base HEAD <default-branch>)..HEAD`, the default branch
named in `docs/agents/workflow.md`. Otherwise `<last-audited-commit>..HEAD`. On a shallow clone
(`git rev-parse --is-shallow-repository` prints `true`) run `git fetch --unshallow` first, or the
merge base is silently wrong.

## What goes stale

| Doc | Facts that rot |
|---|---|
| `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md` | commands, business-area table, invariant wording, package tree, structural-net command, folder table |
| `.claude/skills/<own>/SKILL.md` | file and class names, snippets, step lists, rule names, test names |
| `docs/adr/*.md` | a decision the code no longer follows — needs a new ADR or a status change, never a silent edit |
| `GLOSSARY.md` | terms, their states and transitions, *Avoid* lists |
| `docs/agents/workflow.md` | tracker, CLI, branch and merge rules |
| `backend/*/src`, `frontend/src` prose | `package-info.java` and Javadoc / TSDoc naming members, test names describing old behaviour |

Vendored skills (listed in `skills-lock.json`) are pinned upstream copies: never edit them; a
stale one is reported, not patched.

## Procedure

1. List the diff's fact changes as `old → new`: renames, moves, removals, a mechanism swapped,
   a new area, rule, command or skill.
2. Grep the docs for every old name and wording:

   ```bash
   grep -rn "<old>" AGENTS.md backend/AGENTS.md frontend/AGENTS.md GLOSSARY.md \
     docs/adr docs/agents .claude/skills
   ```

   Then grep `backend/*/src` and `frontend/src` and read only the prose hits; a code hit is the
   compiler's job. A doc that states a count ("the six rules", "three Gradle modules") is a
   finding when the count changed — and worth rewriting to name the members or point at the
   source of truth.
3. Read each doc in the diff's area top to bottom: does the change falsify a sentence that
   shares no identifier with it ("listeners run in the publisher's transaction" after a switch
   to `@ApplicationModuleListener`)?
4. Fix small factual errors in place, in the same branch. A decision's substance (an ADR, a
   glossary definition, an invariant) goes to the human with the exact sentence; never rewrite a
   decision silently. Invariants are never renumbered.
5. Run `node scripts/check-agent-docs.mjs`.
6. Report one line per finding: `doc:line — stated fact — contradicted by — action`. Zero
   findings is a valid result; say so, with the range audited.

## Scope

Present-tense facts in this repo only. History, examples marked as such, and the `catalog`
sample's own text ("while it exists") are not findings. `docs/superpowers/` holds working
specs and plans, not durable docs — not audited.
