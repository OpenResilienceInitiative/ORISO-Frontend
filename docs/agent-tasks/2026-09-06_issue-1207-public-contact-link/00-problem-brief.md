# 00 — Problem brief: public contact link (#1207)

- **Issue:** [#1207](https://github.com/OpenResilienceInitiative/ORISO-Frontend/issues/1207) — "Public contact link: clarify purpose against ADRs, decide hide vs. keep"
- **Branch:** `claude/1207/public-contact-link-analysis` (from `upstream/dev` @ `501959f3`)
- **Deliverable:** an **analysis**, not code. Jobs 1–2 of the issue (ADR/epic sweep + findings comment) plus a reasoned recommendation for job 3. Job 4 (implement) waits on the product decision, which the issue assigns to **Frank**.
- **Image:** `screenshots/issue-annotated-report.png`
- **Assignees:** Shirloin, Storypapst, nikunjdecyb

## Transcribed from the annotated image (binding)

- **Headline (yellow):** _"PRIO LOW: hide open link contact link"_
- **JOB (dark box):** _"Analyse why is the public link needed, look please into the latatest ADRs and what epic hold this functionality back."_
- **Red-boxed area (the defect location)** — the German profile section:
    - `Anzeigename: uebungs_berater_schulden_22`
    - **Öffentlicher Kontakt-Link** (with a pencil/edit affordance)
    - hint: _"Verwenden Sie nur Kleinbuchstaben und Bindestriche. Neue Namen werden erst nach Freigabe durch eine Administration aktiv."_
    - empty field: _"Name des öffentlichen Kontakt-Links"_
    - fallback: _"Es ist noch kein öffentlicher Link-Name aktiv. Der UUID-Link wird weiterhin verwendet."_
    - followed by **Meine Beratungsstellen**

Note the tension to resolve in the recommendation: the **headline says "hide"**, while the platform design rule quoted in the archaeology comment says **"disable, don't hide"**.

## What the issue asks for

1. Search the ADRs and epics for the public contact link / QR-code feature; document purpose, intended flow, and what part is unfinished (admin approval flow?).
2. Post the findings as a comment with ADR references.
3. Product decision (Frank): keep visible · render disabled with a hint · remove until the blocking epic ships.
4. Implement the decision.

## Acceptance (from the issue)

- [ ] AC1 Findings comment with ADR/epic references exists
- [ ] AC2 Decision recorded and implemented ← blocked on Frank; this task prepares it

## Constraint from the archaeology comment (2026-08-26)

> The feature is live UI today … So the analysis job is about _intent and completeness_, not existence — the ADR/epic sweep is the actual deliverable and has not been dug yet. Note the platform design rule "disable, don't hide" when proposing the outcome.

## Method

`superpowers:brainstorming`, **spike** path: the output is an answer and a recommendation, not code. No production change is made on this branch.
