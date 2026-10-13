# Conversation history regression

This browser fixture mounts the actual SessionStream/SessionItem and production
MatrixClientService. It initializes the real Matrix SDK, Rust crypto and IndexedDB.
Only external Matrix and ORISO HTTP responses are intercepted. All identities,
messages and tokens are synthetic; no Dev server or real account is contacted.

Run with Node22 and installed Chrome:

```sh
npm run test:chat-history
```

The six scenarios verify backward pagination past100 messages, chronological
uniqueness, retained reading position, cursor exhaustion, short and metadata-only
initial windows, historical versus newly arriving thread replies, a normal wheel
retry after HTTP500, and mounting before initial Matrix sync finishes. The public
notification-context output contract is observed through a fixture output
element. NotificationsContext contains synthetic application state.

The fixture uses plaintext messages. It proves loading and rendering behavior,
not recovery of missing encryption keys, mobile behavior or Dev acceptance.
