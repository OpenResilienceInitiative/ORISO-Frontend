# Phase 1 — consolidating the prior call work

Four pull requests hold it, all under issue **#780**. Assessed read-only
against current `dev` (`d3f9d1412`) with `git merge-tree`.

A clean textual merge is not a passing build. Nothing below was tested;
test counts are the authors' claims unless stated otherwise.

---

## The finding that matters most

**Neither PR shows who is in the call right now.**

Both build the attendance list as a *cumulative union* — a Map that is only
ever added to — so a person who joins and leaves stays in the list forever.
#1395 went further and **removed** the "In the call" label from running
cards; its own test asserts the `participants.current` string is gone. Every
state is labelled "Attended".

That is a defensible thing to build. It is not the thing we need. "Ich sehe,
dass die anderen drin sind" is **live presence**, and it is the one piece
neither PR has.

Call v2 needs both, explicitly separated:

- **present now** — derived from `session.memberships` at refresh time, and
  *removed* on leave;
- **attended** — the cumulative history, which is what the ended card shows.

`callLifecycleTracker.ts` in #1395 already subscribes to `MembershipsChanged`
and reads `session.memberships`, so the live data is in hand. Only the
merge semantics and the label throw it away. This is a small change on top
of #1395, not a rewrite.

---

## Merge order

| # | PR | Why here |
| --- | --- | --- |
| 1 | **#1394** — Storybook Matrix harness | Isolated, test-only, no runtime edits. Clean merge. It repairs the harness the other call stories need, so it goes first. |
| 2 | **#1390** — appointment payload + timezones | Isolated, clean merge, `Appointment.tsx` untouched on dev since its base. |
| 3 | **#1395** — lifecycle runtime + durable timeline | Clean merge today. **Blocked on backend #1153** (`/service/matrix/calls/state`). Re-run `merge-tree` at merge time: dev has moved 562 commits since its base. |
| 4 | *(new branch)* — the #1361 remainder | Fresh from dev. See below. |

## #1361 — do not merge the branch

131 files, +9690/−1094, **58 conflicted files** against dev (28 source, 30
generated email files). Its lifecycle core is superseded by #1395, which is
the same idea re-authored on current dev with better machinery: serialized
sends per call, dedupe by content signature, transaction-ID reuse, bounded
retries with backoff.

What only #1361 has, and what Call v2 may want cherry-picked onto a fresh
branch:

- the **scheduled** state and the calendar action (`GroupChatCalendarMenu`)
- notification-centre entries
- the call notification **emails** and their translation tooling
- appointment timeline cards
- `participant_count` and `actor_user_id` in the payload

What to leave behind, with reasons:

- its `callTimelineMessageService` design — `pendingCalls` plus a
  `findOriginal` that scans the live timeline for an event id. #1395's
  `publish()` replaces it.
- its **lenient parser**, which accepts content with no msgtype at all.
- the 57 generated email files under `src/emails/dist/`. Regenerate.
- `package.json` and `iconCatalog.generated.json` diffs. Regenerate.
- `AppointmentTimelineSystemMessage.tsx` — imported only by its own test and
  story. Nothing renders it. Rewrite or delete.
- the `scheduled` state **for now**: no frontend producer exists, and no
  backend producer was found.

## Overlap

#1361 and #1395 touch **23 of the same files** and share the msgtype
(`org.oriso.call.lifecycle`) and payload key (`org.oriso.call`). #1395's
parser silently drops `scheduled` events. **They must not both be merged.**

#1394 and #1390 share no paths with each other or with the other two.

## Runtime dependency we cannot verify here

#1395 fetches `/service/matrix/calls/state` and, when the backend returns
`participantMatrixIds`, replaces the participant list with those IDs.
Whether that endpoint exists, and whether its list means *current* or
*cumulative*, could not be determined — the ORISO-UserService repository
returns 403 for this session. **This must be answered before #1395 is
merged**, because it decides whether the backend or the client owns
presence.

## Open questions for the product owner

1. Does Call v2 want the **scheduled** state at all, or only running /
   ended / missed? It carries the whole calendar and notification-centre
   tail behind it.
2. Do the call **notification emails** from #1361 belong in this epic, or do
   they ship separately? Dev already has 126 `anruf-*` templates with
   different content.
