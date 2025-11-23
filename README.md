# HiveMind — Sovereign Memory Mesh
_ETHGlobal Buenos Aires 2025 build by Mycelia Tech_

HiveMind turns personal AI memory vaults into a coordinated, sovereign network. Each node runs a local-first MCP server, speaks libp2p, and backs up encrypted knowledge shards across trusted peers—no central coordinator, no forced cloud tenancy.

## Hackathon
| Field | Details |
| --- | --- |
| Goal | Ship node-to-node intent coordination |
| Stack | Working MCP comms + ingestion; Mesh coordination |

## Problem
Digital memory today is broken. Your thoughts, voice notes, chats, and ideas live inside centralized
silos (Google, Notion, OpenAI, Telegram). You rent access to your own history, and the moment a
server shuts down, a policy changes, or an account is blocked—your memory disappears.
**Mycelia Mesh fixes this by introducing:**
- Self-sovereign ownership of personal AI memory
- Peer-to-peer intelligence coordination
- Decentralized, censorship-resistant backups
- Infrastructure built for autonomy, not surveillance
## Why HiveMind?
- **Memory is siloed**: Chats, notes, and voice memos sit in accounts you rent.
- **Context disappears**: You remember a conversation, not the details that matter.
- **Central servers fail**: A TOS change can delete your cognitive history overnight.

## Our Answer
HiveMind links local AI memories into a federated mesh:
- Nodes store and index private data locally
- Intents are broadcast over libp2p for cross-node help
- Replicate itself as encrypted shards across trusted peers
- Decentralized compute handles GPU/CPU

## Core Capabilities
- **🔗 Node-to-node comms**: libp2p discovery, Noise-encrypted streams, MCP tool surface.
- **🧠 Agent cooperation**: Intent extraction, capability matching, distributed execution.
- **💾 Sovereign backups**: Sharded, encrypted replication with trust/geo heuristics.


## Architecture
```
┌──────────────┐      libp2p       ┌──────────────┐
│ Your Node    │◄────────────────►│ Peer Node    │
│              │                  │              │
│ - Local DB   │                  │ - Local DB   │
│ - AI Agent   │                  │ - AI Agent   │
│ - Intent AI  │                  │ - Intent AI  │
│ - Backup     │                  │ - Backup     │
└──────┬───────┘                  └──────┬───────┘
       │                                  │
       ▼                                  ▼
   Fluence CPU/GPU                  Fluence CPU/GPU
(compute + inference)            (compute + inference)
```

## Track Alignment
- **Sovereign Systems**: No central coordinator; peers control identity, storage, and routing.
- **AI Infrastructure**: Multi-agent workflows + local LLMs.

## Current Progress
- ✅ MCP server (`server.js`) with libp2p messaging, inbox, contact management.
- ✅ Knowledge ingestion/query via `scripts/llamaindex_ingest.py` (uses `uv run`).
- ✅ Demo agents (`npm run demo:agents`) showing task chaining across peers.
- 🛠 Intent mesh broadcaster + capability negotiation layer.
- 🛠 Encrypted backup daemon with trust scoring + heal/restore flows.




## Setup
```bash
git clone https://github.com/mycelia-tech/submarino
cd submarino
npm install
cp .env.example .env
```
Set `PORT`, `KEY_PATH`, and any Fluence/libp2p secrets as needed.

### Run the MCP node
```bash
npm run dev            # ts-node dev server
npm run build && npm start   # compile to dist/ then serve
```

### Auto-restart `dist/index.js` locally
1. Run `npm run build` once so `dist/index.js` exists.
2. Start the watcher: `npm run watch:index`

`node --watch` restarts `dist/index.js` whenever the compiler rewrites it, which keeps a long-running MCP node in sync while you iterate. Run `npm run build` (or `npm run dev`) in another terminal whenever you change source files so that `dist/index.js` updates.

### Sync & restart remote nodes
- Script: `scripts/remote-update.sh`
- Default hosts: `81.15.150.153` and `81.15.150.22`
- Requirements: passwordless SSH for each host, Node/npm installed on the remote, and this repo already cloned.

Environment overrides (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `REMOTE_USER` | `pk` | SSH username |
| `REMOTE_PATH` | `/home/$REMOTE_USER/submarino` | Path to the repo on the remote |
| `REMOTE_BRANCH` | `main` | Branch to track |
| `REMOTE_RESTART_CMD` | `npm run start` | Command that restarts your process manager |
| `SSH_OPTS` | _(empty)_ | Extra flags (`-i`, `-o StrictHostKeyChecking=no`, etc.) |

Usage example (restart via PM2 on Ubuntu):
```bash
REMOTE_USER=ubuntu \
REMOTE_PATH=/opt/submarino \
REMOTE_RESTART_CMD="pm2 restart submarino" \
bash scripts/remote-update.sh
```

The script performs `git fetch && git reset --hard origin/$REMOTE_BRANCH`, installs deps, rebuilds, and runs the restart command on each host. Add a cron entry or systemd timer to keep the nodes up-to-date automatically, e.g.:
```cron
*/5 * * * * REMOTE_USER=ubuntu REMOTE_PATH=/opt/submarino bash /home/ubuntu/submarino/scripts/remote-update.sh >> /var/log/submarino-sync.log 2>&1
```

Ensure the SSH key used for automation only has access to the required hosts and repository.

### Demo agent collaboration
```bash
npm run demo:agents
```
Launches three local peers that exchange multiply/sum workloads using the shared MCP channel.

## Filecoin integration (experimental)
- Install the [Lotus daemon](https://docs.filecoin.io/run/lotus/install) and ensure you can run a lite node:
  ```bash
  lotus daemon --lite
  ```
- Verify the node is reachable through JSON-RPC (Submarino runs the same health check described in the Filecoin docs):
  ```bash
  curl -X POST http://127.0.0.1:1234/rpc/v0 \
    -H "Content-Type: application/json" \
    -d '{ "jsonrpc": "2.0", "method": "Filecoin.ChainHead", "params": [], "id": 1 }'
  ```
- Set `FILECOIN_LOTUS_BINARY` if you want the server to spawn the lite node automatically, or expose an existing RPC endpoint via `FILECOIN_RPC_URL`. When no custom RPC is provided, Submarino defaults to running `lotus daemon --lite` from your `$PATH`; set `FILECOIN_AUTO_SPAWN=false` to disable this behavior.
- On boot, `index.js` loads `filecoin.js`, waits for the chain head, and pushes a JSON snapshot of trusted peers via `Filecoin.ClientImport`. Snapshot files live under `.filecoin/snapshots`.
- Once the MCP server is running, call `GET /filecoin/health` to confirm Lotus is reachable. A `200` response includes the latest height, RPC endpoint, and tipset keys; `503`/`500` indicates the RPC is still warming up or unreachable (logs also stream under the `[filecoin]` prefix).
- Need a local dev target? Run `npm run mock:filecoin` to boot a JSON-RPC stub on `http://127.0.0.1:1234/rpc/v0`, then start the MCP server with `FILECOIN_AUTO_SPAWN=false` to exercise the integration without a full Lotus install.

### Ingest & query knowledge (optional)
   ```bash
   uv run scripts/llamaindex_ingest.py ingest --reset
uv run scripts/llamaindex_ingest.py query "Which agent multiplies?"
```
Data persists under `.llamaindex/agents`; add your own JSON via `-i`.

## MCP Server Overview
- **Tools**: `send_message`, `check_inbox`, `create_contact`, `list_contacts`, `get_my_id`, etc.
- **Storage**: Peer IDs live in `.keys/peer-id.json`; inbox is Map-backed with read/unread flags.
- **Transport**: Custom libp2p protocol (Noise + Yamux/Mplex over TCP) defined in `server.js`.

## Environment Variables
- `PORT` — HTTP server port (default `4242`)
- `KEY_PATH` — Directory for libp2p key material (default `./.keys`)
- `FLUENCE_PRIVATE_KEY`, `LIBP2P_PEER_MULTIADDR`, etc., when targeting Fluence/remote peers
- `FILECOIN_LOTUS_BINARY` — Optional path to `lotus`; when present Submarino spawns a lite daemon.
- `FILECOIN_RPC_URL` — JSON-RPC endpoint for Filecoin (default `http://127.0.0.1:1234/rpc/v0`).
- `FILECOIN_RPC_TOKEN` — Bearer token for authenticated RPC calls.
- `FILECOIN_REPO` — Directory for Lotus repo data and stored snapshots (default `./.filecoin`).
- `FILECOIN_START_TIMEOUT_MS` — Milliseconds to wait for Lotus RPC readiness (default `45000`).
- `FILECOIN_AUTO_SPAWN` — Set to `false` to skip launching a local Lotus process and rely solely on `FILECOIN_RPC_URL`.

## License
MIT — fork, remix, and extend the mesh. Sovereignty or bust.

**TL;DR:** HiveMind is the sovereign memory mesh for ETHGlobal Buenos Aires. Not your node, not your mind.***
