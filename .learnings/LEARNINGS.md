# 2026-07-08 — matrix-js-sdk production logging

`matrix-js-sdk` defaults child loggers to `DEBUG`, so `FetchHttpApi` sync lines appear even when app `console.log` calls are removed. Call `logger.setLevel('error')` at startup and patch `getChild` so child namespaces inherit the same level; pass `logger` into every `createClient` call.
