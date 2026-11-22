# Activity desktop rail

With this worktree's Storybook running on port6018:

```bash
node playwright/activity-timeline-rail-1871/verify.mjs
```

Override `STORYBOOK_URL` or `EVIDENCE_DIR` if needed. The default evidence folder is
`oriso-activity-rail` inside the OS temporary directory. The script creates and closes an isolated Chrome profile
because persistence across a genuine reload is part of the test. It uses the real
`FilledTimeline` story, whose fixture does not seed the list-width preference.

It checks dragging to80px, persistence across reload, hover information, event
selection, keyboard scrolling, desktop boundary1199/1200, tablet/phone normal
cards, returning to the saved desktop rail, expansion to397px and unchanged
joined group geometry with rounded final corners. It records a video and stills.
This is local component proof, not deployed or authenticated acceptance.
