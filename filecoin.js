import { spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join, resolve } from 'path';

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

export class FilecoinNodeManager {
  constructor(options = {}) {
    this.rpcUrl = options.rpcUrl || process.env.FILECOIN_RPC_URL || 'http://127.0.0.1:1234/rpc/v0';
    this.authToken = options.authToken || process.env.FILECOIN_RPC_TOKEN || null;
    this.repoDir = resolve(options.repoDir || process.env.FILECOIN_REPO || '.filecoin');
    this.lotusBinary = options.lotusBinary || process.env.FILECOIN_LOTUS_BINARY || null;
    this.startTimeoutMs = Number(options.startTimeoutMs || process.env.FILECOIN_START_TIMEOUT_MS || 45_000);
    this.process = null;
    this.ready = false;
  }

  async start() {
    if (this.ready) {
      return;
    }

    await mkdir(this.repoDir, { recursive: true });

    if (this.lotusBinary && !this.process) {
      const lotusPath = join(this.repoDir, 'lotus');
      this.process = spawn(this.lotusBinary, ['daemon', '--lite'], {
        env: {
          ...process.env,
          LOTUS_PATH: lotusPath,
        },
        stdio: 'inherit',
      });

      this.process.on('exit', (code, signal) => {
        console.log(`[filecoin] lotus daemon exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
        this.process = null;
        this.ready = false;
      });
    }

    await this.waitForRpc();
    this.ready = true;
  }

  async waitForRpc() {
    const deadline = Date.now() + this.startTimeoutMs;

    while (Date.now() < deadline) {
      try {
        await this.chainHead();
        console.log('[filecoin] JSON-RPC endpoint is reachable');
        return;
      } catch (error) {
        await sleep(2000);
      }
    }

    throw new Error('Filecoin RPC endpoint not reachable before timeout');
  }

  async request(method, params = []) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Filecoin RPC request failed with status ${response.status}`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(`Filecoin RPC error: ${payload.error.message ?? 'unknown error'}`);
    }

    return payload.result;
  }

  async chainHead() {
    return this.request('Filecoin.ChainHead', []);
  }

  async storeDatabaseSnapshot(snapshot, options = {}) {
    if (!this.ready) {
      await this.start();
    }

    const snapshotDir = resolve(this.repoDir, 'snapshots');
    await mkdir(snapshotDir, { recursive: true });

    const fileName = options.fileName || `db-${Date.now()}-${randomUUID()}.json`;
    const filePath = join(snapshotDir, fileName);
    const contents = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot, null, 2);

    await writeFile(filePath, contents, 'utf8');

    const result = await this.request('Filecoin.ClientImport', [
      {
        Path: filePath,
        IsCAR: false,
      },
    ]);

    const cid = result?.Root?.['/'] ?? null;
    console.log(`[filecoin] Stored snapshot ${fileName}${cid ? ` (cid: ${cid})` : ''}`);

    return {
      cid,
      path: filePath,
    };
  }

  async stop() {
    if (this.process) {
      this.process.kill('SIGINT');
      this.process = null;
    }

    this.ready = false;
  }
}
