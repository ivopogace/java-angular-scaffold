# Workflow

Project facts the development process needs and cannot infer from the code. Fill in each section
when the project gets its VCS host and tracker; agents read this before creating issues, branches or
merge requests. Until a section is filled in, agents ask instead of guessing.

## Issue tracker

TODO: where issues live (GitHub Issues, GitLab Issues, Jira, none), how a commit or branch
references one, and which label or state means "ready to work on".

## CLI

TODO: the host CLI agents may use (`gh`, `glab` or none) and which of its actions need asking first.

## Branch naming

TODO: the branch pattern (for example `feat/<issue>-<slug>`) and the default branch. Agents never
push to the default branch directly.

## Merge rules

TODO: required checks (CI runs `node scripts/verify.mjs`), required reviews, squash or merge commits,
and who merges.
