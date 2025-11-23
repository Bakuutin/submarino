# HiveMind — Sovereign Memory Mesh
Built by [Mycelia Tech](https://mycelia.tech/) for ETHGlobal Buenos Aires 2025.

HiveMind links personal AI memory vaults into a sovereign, peer-to-peer network. Each node runs a local-first MCP server, speaks libp2p, and can back up encrypted shards across trusted peers—no central coordinator, no forced cloud tenancy.

## Why this exists
- **Memory is rented**: Chats, notes, and voice memos live in SaaS silos you do not control.
- **Context evaporates**: You recall the conversation, not the facts.
- **Central chokepoints**: TOS changes or outages can delete your cognitive history overnight.
- **Our answer**: Self-owned memory, peer-to-peer coordination, sovereign backups, and distributed compute.

## What’s here
- **MCP node**: Express + MCP server with libp2p direct-messaging surface (`/mcp` endpoint).
- **Communication protocol**: Noise-encrypted libp2p streams, pubsub discovery, trusted-peer gate, delegated routing fallback.
- **Agents demo**: Three cooperating peers (actor + two workers) exchanging tasks over the shared channel.
- **Data ingestion**: LlamaIndex pipeline for local knowledge (`scripts/llamaindex_ingest.py`).
- **Filecoin hooks (WIP)**: Snapshot helper available in `dist/filecoin.js`; not enabled in the default runtime yet.

## Quick start
```bash
git clone https://github.com/mycelia-tech/submarino
cd submarino
npm install
cp .env.example .env   # set PORT, KEY_PATH, Filecoin RPC if used

npm run dev            # start MCP/libp2p node locally
```

### Configure your environment
Edit `.env` before running:
- `PORT` — HTTP/MCP port (default `4242`). Open inbound on your server firewall.
- `KEY_PATH` — where peer keys and `trustedPeers.json` live. Persist this directory so identity survives redeploys.
- `FILECOIN_*` — Filecoin helper is enabled by default. Set `FILECOIN_RPC_URL`/`FILECOIN_RPC_TOKEN` to point at your Lotus endpoint, or leave defaults to auto-spawn a local Lotus lite daemon if available.

### Talk to the MCP node
The MCP server lives at `http://localhost:${PORT}/mcp` and exposes tools for messaging and trust management:
- `send_message` — send a payload to peer IDs
- `check_inbox` — read messages already accepted
- `add_trusted_peer` / `remove_trusted_peer` / `list_trusted_peers`
- `get_my_id` — peer ID, multiaddrs, and connected peers

### Run the agent collaboration demo
```bash
npm run demo:agents
```
Spins up actor + two compute peers. The actor requests `multiply(6, 7)` then `sum(result, 5)` across the mesh and exits.

### Ingest and query local knowledge (optional)
```bash
uv run scripts/llamaindex_ingest.py ingest --reset
uv run scripts/llamaindex_ingest.py query "Which agent multiplies?"
```
Data lives under `.llamaindex/agents`; add your own JSON via `-i`.

## Communication protocol (high level)
- **Discovery**: mDNS + pubsub (`submarino-peer-discovery`) with optional delegated routing via `https://delegated-ipfs.dev`.
- **Transports**: WebRTC, WebSockets, QUIC, TCP, circuit-relay; multiplexed with Yamux; encrypted with Noise.
- **Direct messages**: Custom protocol `/universal-connectivity/dm/1.0.0` using protobuf framing (`direct-message.proto` → `direct-message.js`). Messages include metadata (version, timestamp) and return `Status.OK` on success.
- **Trust gate**: Incoming DMs are accepted only from peer IDs in `trustedPeers.json`. Manage via MCP tools before exchanging payloads.
- **Bootstrap**: Optional dial to `/dnsaddr/sg1.bootstrap.libp2p.io/...` plus auto-dial of known/trusted peers.
- **Failure handling**: Timeouts on dialing and streaming; inbox kept in-memory per node; key material persisted to `.keys/peer-id.json`.

## Deploying a node
- **Prereqs**: Node.js 22+, git, outbound internet for libp2p, inbound `PORT` open (default 4242). Persistent storage for `KEY_PATH` so identity survives restarts.
- **Bootstrap on a remote host**:
  1) `git clone https://github.com/mycelia-tech/submarino && cd submarino`
  2) `npm install`
  3) `cp .env.example .env` and set `PORT`/`KEY_PATH` (and `FILECOIN_*` if you plan to experiment)
  4) Test: `npm run dev` and confirm the peer ID prints in logs
  5) Prod: `npm start` (sets `NODE_ENV=production`). Optional: append `--hook https://your-webhook` to forward inbound messages.
- **Keep it running (systemd example)**:
  ```
  [Unit]
  Description=Submarino MCP Node
  After=network.target

  [Service]
  WorkingDirectory=/opt/submarino
  ExecStart=/usr/bin/env NODE_ENV=production node /opt/submarino/index.js --hook https://example.com/hook
  Restart=always
  EnvironmentFile=/opt/submarino/.env

  [Install]
  WantedBy=multi-user.target
  ```
  Reload systemd, then `systemctl enable --now submarino`.
- **Backups**: Persist the `KEY_PATH` directory (default `.keys/mcp`) and `trustedPeers.json`. Restoring these preserves identity/trust. Filecoin snapshots are attempted automatically at startup; ensure your RPC/lotus binary is reachable.

## Roadmap (next passes)
- Intent mesh broadcaster + capability negotiation (multi-hop routing).
- Encrypted backup daemon with trust scoring and heal/restore flows.
- Hardened inbox persistence and audit trail.
- More MCP surfaces: mesh health, capability directory, and async job receipts.

## License
MIT — fork, remix, and extend the mesh.

**TL;DR:** HiveMind is the sovereign memory mesh. Not your node, not your mind.
