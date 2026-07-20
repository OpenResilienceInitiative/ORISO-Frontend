# Storybook MCP Setup

This repo already has Storybook MCP enabled through `@storybook/addon-mcp`.
The MCP server starts inside the Storybook dev server and is available at:

```text
http://localhost:6006/mcp
```

Local Storybook notes also exist in `.storybook/README.md`.

## Prerequisites

Use Node 24 for Storybook work.

The repo package only declares `node >=18.16.1`, but Storybook failed locally on
Node 25 with:

```text
Error: Invariant failed: expected options to have a port
```

Recommended setup:

```bash
nvm install 24
nvm use 24
npm ci
```

If your machine does not use `nvm`, use the team-approved Node version manager,
but make sure `node --version` prints `v24.x`.

## Run Storybook

From the frontend repo root:

```bash
npm run typecheck:storybook
npm run storybook
```

Open:

```text
http://localhost:6006
```

If port `6006` is busy, run Storybook on another port:

```bash
npm exec -- storybook dev --port 6010 --host 127.0.0.1 --ci --no-open --exact-port
```

When using a different port, update the MCP URL for Codex, Cursor, and curl
checks to match that port, for example:

```text
http://localhost:6010/mcp
```

## Verify The MCP Endpoint

Storybook must be running before this check:

```bash
curl -X POST http://localhost:6006/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expected result: a JSON-RPC response with a `tools` list. Useful Storybook MCP
tools include:

- `list-all-documentation`
- `get-documentation`
- `get-documentation-for-story`

## Add Storybook MCP To Codex

Start Storybook first, then register its HTTP MCP endpoint:

```bash
codex mcp add storybook --url http://localhost:6006/mcp
codex mcp list
codex mcp get storybook
```

Optional official Storybook Codex plugin path:

```bash
codex plugin marketplace add storybookjs/mcp --ref main
codex plugin add storybook@storybook
```

The plugin is optional because this repo already exposes the Storybook MCP
server through `@storybook/addon-mcp`.

## Add Storybook MCP To Cursor

Cursor reads MCP servers from JSON config. You can configure the Storybook MCP
server either globally for your machine or only for this workspace.

### Workspace Config

Create `.cursor/mcp.json` in this repo:

```json
{
	"mcpServers": {
		"storybook": {
			"url": "http://localhost:6006/mcp"
		}
	}
}
```

Use this when the MCP server is specific to this repo. If the team commits this
file, everyone using Cursor in this workspace gets the same Storybook MCP entry.

### Global Config

Create or edit:

```text
~/.cursor/mcp.json
```

Add:

```json
{
	"mcpServers": {
		"storybook-oriso-frontend": {
			"url": "http://localhost:6006/mcp"
		}
	}
}
```

Use the global config when you do not want to commit local MCP settings to the
repo.

### Enable It In Cursor

1. Start Storybook with `npm run storybook`.
2. Open Cursor.
3. Open Cursor settings.
4. Go to the MCP settings section.
5. Confirm the Storybook server is listed and connected.
6. In Agent chat, ask Cursor to use the Storybook MCP, for example:

```text
Use the Storybook MCP to list the available ORISO component stories.
```

If Cursor does not show the server, restart Cursor after editing `mcp.json`.

## Current Repo Wiring

- Storybook script: `npm run storybook`
- Storybook port: `6006`
- MCP endpoint: `http://localhost:6006/mcp`
- Story glob: `src/components/**/*.stories.@(ts|tsx)`
- MCP addon: `@storybook/addon-mcp`
- Storybook builder: `@storybook/react-vite`

The MCP only sees stories included by the Storybook config. If a component is not
discoverable through MCP, add or migrate a `.stories.ts` or `.stories.tsx` file
under `src/components/`.

## Troubleshooting

### Storybook Writes To `~/.storybook`

In restricted agent sandboxes, Storybook may fail while writing global settings
under `~/.storybook`. For local development on a normal machine this should not
matter. In a sandbox, use a writable temporary home:

```bash
HOME=/tmp/oriso-storybook-home npm run storybook
```

### Port 6006 Is Busy

Use another port:

```bash
npm exec -- storybook dev --port 6010 --host 127.0.0.1 --ci --no-open --exact-port
```

Then configure agents with:

```text
http://localhost:6010/mcp
```

### MCP Returns Connection Errors

Check these in order:

1. Storybook is running.
2. The MCP URL uses the same port as Storybook.
3. `curl` returns a JSON-RPC response from `/mcp`.
4. Restart Codex or Cursor after changing MCP config.
