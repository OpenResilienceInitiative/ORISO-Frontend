# #1211 — Notifications not delivered/played

## The report

"Benachrichtigungen werden nicht abgespielt" — notifications are not played. The
issue asks for an analysis first: a per-event matrix of what fires and what does
not, with the broken paths root-caused, and the fixes after that.

## Scope of this task

Jobs 1–3 (enumerate, test, post the matrix) plus the frontend half of job 4.
Anything rooted in ORISO-UserService is filed here with a root cause and left to
its own PR, as the issue asks.

## What the linked screenshot is

`docs/evidence/mvp-showstopper/20-high-notifications-not-played.png` is the
annotated report sticky — the dark box is the DEBUG-1 instruction and the red
line runs down the edge of a chat panel. It marks the area under discussion, not
a defect location. The analysis below is from the code, not from that image.

## Prior direction taken into account

Storypapst's comment on the issue (2026-08-26) asks to start the enumeration
from the UserService `event_notification` subsystem rather than the frontend,
and to include the audio path explicitly because browser autoplay policy can
masquerade as "notifications broken".

Both were followed. On the autoplay point the answer turned out to be no: see
[01-spike.md](01-spike.md) — the sound path returns before it ever constructs an
`Audio` element, so there is no `play()` for a policy to reject.
