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
- Set `FILECOIN_LOTUS_BINARY` if you want the server to spawn the lite node automatically, or expose an existing RPC endpoint via `FILECOIN_RPC_URL`.
- On boot, `index.js` loads `filecoin.js`, waits for the chain head, and pushes a JSON snapshot of trusted peers via `Filecoin.ClientImport`. Snapshot files live under `.filecoin/snapshots`.

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

## License
MIT — fork, remix, and extend the mesh. Sovereignty or bust.

**TL;DR:** HiveMind is the sovereign memory mesh for ETHGlobal Buenos Aires. Not your node, not your mind.***
