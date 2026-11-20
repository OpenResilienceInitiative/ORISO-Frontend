# ADR-022: Answer several marked passages in one message

- Status: Proposed (draft, not yet reviewed)
- Date: 2026-11-10
- Owners: ORISO Frontend and Platform
- Decision scope: ORISO-Frontend; Matrix event content; every service that reads
  chat messages (retention, export, notifications)
- Related: Relations foundation #435 (`m.in_reply_to` replies); voice notes #1142
  (no transcript); branch `feat/quote-reply-selection-storybook`
  (`src/components/selectionReply/`, story "8 · Vier Stellen, eine Nachricht")

## Context

Counsellors answer long client messages point by point. The selection reply lets
them mark a passage, comment on it by text or voice note, mark the next passage,
and so on. The product owner decided (2026-11-10) that all collected comments
leave as **one** message, like a review with several inline comments. The
message shows one block per passage: the quote, then its text or voice clip.
Clicking a quote returns to the passage.

Today a Matrix reply points at exactly one event (`m.relates_to.m.in_reply_to`),
and a voice note is one `m.audio` event holding one file. Neither can express
"three passages, two clips, two texts" in one event.

## Decision (proposed)

One `m.room.message` event (`msgtype: m.text`) carries an ordered list of answered
passages in an ORISO namespace field, plus a plain-text fallback in `body`:

```json
{
	"msgtype": "m.text",
	"body": "> Da sind drei Mahnungen vom Inkassobüro …\n[Sprachnachricht 0:48]\n\n> ein Brief vom Amtsgericht …\nDen Brief vom Amtsgericht schauen wir uns zuerst an.",
	"org.oriso.passage_replies": [
		{
			"event_id": "$client-message",
			"excerpt": "Da sind drei Mahnungen vom Inkassobüro, …",
			"audio": {
				"url": "mxc://…",
				"mimetype": "audio/webm",
				"duration_ms": 48000,
				"size": 51234
			}
		},
		{
			"event_id": "$client-message",
			"excerpt": "ein Brief vom Amtsgericht, den ich überhaupt nicht verstehe",
			"text": "Den Brief vom Amtsgericht schauen wir uns zuerst an."
		}
	]
}
```

- `excerpt` is stored as marked, so the quote survives edits to the original. The
  jump looks the excerpt up in the original message and opens a shortened message
  first.
- In encrypted rooms each clip uses the `file` (EncryptedFile) object instead of
  `url`, exactly as `m.audio` does; the whole content is encrypted as usual.
- Free text typed in the composer goes after the blocks (rendered from `body`'s
  last paragraph or a separate `text` field — open point 2).
- No `m.in_reply_to`: the event answers several passages, possibly in different
  messages. Clients without ORISO support show `body`.

The frontend type is `PassageReply` in `src/components/selectionReply/PassageReplyBlocks.tsx`;
`MessageItem.passageReplies` holds the list.

## Alternatives considered

1. **One message per passage**, which was built first and rejected by the product owner: it floods the
   timeline and splits one thought into many notifications.
2. **All texts in one message, each clip as its own `m.audio` event grouped under
   it**. This needs no new field, but it is not one message: the parts can arrive,
   fail or be deleted separately.
3. **Extensible events (MSC1767) with multiple content blocks** are not stable in
   the Synapse and matrix-js-sdk versions ORISO uses.

## Consequences

- Sending uploads every clip first, then sends one event. A failed upload blocks
  the send and keeps the collection intact.
- Retention, deletion and export must follow every `audio` URL in
  `org.oriso.passage_replies`, not only `m.audio` events.
- Notifications and previews use `body` (needs a short form such as "3 Antworten
  auf markierte Stellen").
- Other Matrix clients (Element) see the fallback only: quotes as `>` lines and
  "[Sprachnachricht 0:48]" without a player.

## Open points

1. Is a custom namespace acceptable under the platform's Matrix-only runtime
   path (platform ADR-004), or does it need a platform ADR twin in ORISO-Docs?
2. Where does the composer's free text live: in `body` only, or as `text` beside
   the list?
3. Limits: maximum passages per message, maximum clip length.
