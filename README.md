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

### Remote automation cheat sheet
- Entry point: `scripts/cluster.sh <command>` (wraps every other helper)
- Logs: `logs/remote/<host>.log` (ignored by git). Every remote SSH session is tee’d into these files.
- Env vars (apply to all scripts):

| Variable | Default | Purpose |
| --- | --- | --- |
| `REMOTE_USER` | `ubuntu` | SSH username |
| `REMOTE_SERVERS` | `81.15.150.153 81.15.150.22` | Space-separated host list |
| `REMOTE_PATH` | `/home/$REMOTE_USER/submarino` | Repo location on the host |
| `REMOTE_LOTUS_PATH` | `/home/$REMOTE_USER/.lotus-lite` | Lotus data dir |
| `SSH_OPTS` | _(empty)_ | Extra ssh/scp flags (`-i`, `-o StrictHostKeyChecking=no`, …) |

Common flows:

| Goal | Command(s) |
| --- | --- |
| Push `.env` everywhere | `REMOTE_USER=ubuntu scripts/cluster.sh env push` |
| Install Lotus release | `scripts/cluster.sh lotus install` |
| Start Lotus lite daemons | `scripts/cluster.sh lotus start` |
| Deploy Submarino | `scripts/cluster.sh deploy` |
| Connect Lotus peers | `scripts/cluster.sh connect` |
| Full bootstrap | `scripts/cluster.sh bootstrap` *(env push → lotus install/start → deploy → connect)* |
| Inspect status | `scripts/cluster.sh status` or `scripts/peer-status.sh` |

`scripts/remote-update.sh`, `scripts/remote-filecoin-daemon.sh`, and `scripts/remote-filecoin-connect.sh` are still available for low-level control (they now accept subcommands; run with `--help`/read the headers for details).

### Remote Filecoin cluster (81.15.150.153 & 81.15.150.22)
1. Give each host passwordless SSH access and install Node/npm (already required by `remote-update.sh`).
2. Copy your `.env` (or set `ENV_FILE=/path/to/env`):\
   `REMOTE_USER=ubuntu scripts/cluster.sh env push`
3. Install Lotus binaries + dependencies:\
   `REMOTE_USER=ubuntu scripts/cluster.sh lotus install`
4. Start the lite daemons & wait for JSON-RPC readiness:\
   `REMOTE_USER=ubuntu scripts/cluster.sh lotus start`
5. Deploy Submarino (git fetch + build + restart):\
   `REMOTE_USER=ubuntu scripts/cluster.sh deploy`
6. Mesh the Lotus peers so they gossip storage:\
   `REMOTE_USER=ubuntu scripts/cluster.sh connect`
7. Sanity-check the mesh and trusted peers:
   ```bash
   REMOTE_USER=ubuntu scripts/peer-status.sh
   # or
   REMOTE_USER=ubuntu scripts/cluster.sh status
   ```
8. Prefer the “easy button”? `REMOTE_USER=ubuntu scripts/cluster.sh bootstrap` runs steps 2‑6 sequentially.

Validation tips:
- `curl -s http://127.0.0.1:4242/filecoin/health | jq` on any host should return `{ ready: true, ... }`
- `lotus net peers` on both servers should list the opposite host after `scripts/cluster.sh connect`
- `scripts/peer-status.sh` prints three things per host: Lotus peers, `/filecoin/health`, and `.keys/mcp/trustedPeers.json`
- When Submarino accepts a trusted peer or dials someone new you’ll see `[mesh] ...` logs in stdout or `logs/remote/<host>.log`

### Demo agent collaboration
```bash
npm run demo:agents
```
Launches three local peers that exchange multiply/sum workloads using the shared MCP channel.

### Run individual agents per server
Use `scripts/run-agent.js` (or `npm run agent:run`) to boot exactly one role per host. The runner reads both CLI flags and env vars so you can launch it with a single `ssh` command.

1. **Start the compute peer (e.g., multiplier) on host `ubuntu@81.15.150.153`:**
   ```bash
   ssh ubuntu@81.15.150.153 '
     cd /opt/submarino &&
     LIBP2P_TCP_PORT=4242 \
     AGENT_ROLE=multiplier \
     node scripts/run-agent.js
   '
   ```
   Copy the printed peer ID and multiaddr (for example `/ip4/81.15.150.153/tcp/4242/p2p/12D3Koo...`).

2. **Start the actor on the second host (`ubuntu@81.15.150.22`) and point it at the multiplier:**
   ```bash
   ssh ubuntu@81.15.150.22 '
     cd /opt/submarino &&
     LIBP2P_TCP_PORT=4242 \
     AGENT_ROLE=actor \
     AGENT_PEERS="multiply=12D3Koo...@/ip4/81.15.150.153/tcp/4242" \
     node scripts/run-agent.js
   '
   ```

3. The actor automatically fires a sample multiply task once the peer is trusted. Press **Enter** in the actor terminal to re-run the task. Add more peers by repeating the process with `AGENT_ROLE=adder` and extending `AGENT_PEERS` (`sum=<peerId>@<multiaddr>`).

**Flags & env vars**
- `AGENT_ROLE` / `--role`: `actor`, `multiplier`, or `adder`.
- `AGENT_PEERS` / `--peer`: comma- or flag-separated entries in the form `capability=peerId@multiaddr[|multiaddr...]`.
- `LIBP2P_TCP_PORT`: pin the libp2p listener (useful for firewalls/NAT; default random).
- `AGENT_OPERANDS` / `--operands`: comma-separated numbers for the sample multiply task (default `6,7`).
- `AGENT_AUTO_SAMPLE=0` disables the automatic demo run on startup.

When you omit `AGENT_PEERS`, the agent still starts but waits until you add peers manually (edit `.keys/agents/<role>/trustedPeers.json` or restart with the flag).

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
- `LIBP2P_TCP_PORT` — Override the libp2p listen port (default random)
- `AGENT_ROLE`, `AGENT_PEERS`, `AGENT_KEY_DIR`, `AGENT_AUTO_SAMPLE`, `AGENT_OPERANDS` — runner-specific knobs for `scripts/run-agent.js`
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
