# Domain docs

Layout: **single-context**. Read only sources relevant to the current task.

1. In a multi-repo workspace, resolve machine-local paths through `~/.config/agent-routing/paths.env` when it exists; follow `${PROJECT_ORISO_ROOT}/AGENTS.md` for shared documentation and policy. In a standalone clone, skip those parent paths and follow the repository's `AGENTS.md` and relevant local documentation directly.
2. Use an existing root `GLOSSARY.md`, or the relevant entries of `GLOSSARY-MAP.md` when present. Use the established vocabulary in issues, code and tests.
3. Read relevant existing repository ADRs under `docs/adr/` or another repository-owned decision directory. Repository-owned ADRs remain beside their code; shared durable cross-repository knowledge belongs in `${KNOWLEDGE_ORISO_ROOT}` and is indexed there.

Missing glossary/ADR files are normal: continue with existing project sources. Create vocabulary or ADRs lazily when a real decision is made, in the location owned by the project rules. Do not copy the shared Core, generated graphs, or the entire documentation tree into this repository or the prompt.
Surface a conflict with an existing ADR explicitly before proposing to change the decision.

Existing local vocabulary: read the relevant terms in `CONTEXT.md` before introducing synonyms.
