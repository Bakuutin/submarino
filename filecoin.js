import { spawn } from 'child_process';
import { mkdir, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { join, resolve } from 'path';

const DEFAULT_RPC_URL = 'http://127.0.0.1:1234/rpc/v0';
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const log = (...args) => console.log('[filecoin]', ...args);

const boolFromEnv = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  return !(normalized === 'false' || normalized === '0' || normalized === 'no');
};

export class FilecoinNodeManager {
  constructor(options = {}) {
    const userProvidedRpc = options.rpcUrl || process.env.FILECOIN_RPC_URL;
    this.rpcUrl = userProvidedRpc || DEFAULT_RPC_URL;
    this.authToken = options.authToken || process.env.FILECOIN_RPC_TOKEN || null;
    this.repoDir = resolve(options.repoDir || process.env.FILECOIN_REPO || '.filecoin');
    this.lotusBinary = options.lotusBinary || process.env.FILECOIN_LOTUS_BINARY || 'lotus';
    this.startTimeoutMs = Number(options.startTimeoutMs || process.env.FILECOIN_START_TIMEOUT_MS || 45_000);
    const autoSpawnDefault = !userProvidedRpc || userProvidedRpc === DEFAULT_RPC_URL;
    this.autoSpawn = boolFromEnv(options.autoSpawn ?? process.env.FILECOIN_AUTO_SPAWN, autoSpawnDefault);
    this.process = null;
    this.ready = false;
    this.spawnedInternally = false;
  }

  async start() {
    if (this.ready) {
      log('Reusing existing Filecoin RPC connection at', this.rpcUrl);
      return;
    }

    await mkdir(this.repoDir, { recursive: true });
    log('Bootstrapping Filecoin manager. RPC:', this.rpcUrl, 'Repo:', this.repoDir);

    if (this.autoSpawn && this.lotusBinary && !this.process) {
      const lotusPath = join(this.repoDir, 'lotus');
      log('Spawning Lotus lite daemon via', this.lotusBinary, 'with repo', lotusPath);
      try {
        this.process = spawn(this.lotusBinary, ['daemon', '--lite'], {
          env: {
            ...process.env,
            LOTUS_PATH: lotusPath,
          },
          stdio: 'inherit',
        });
        this.spawnedInternally = true;

        this.process.on('exit', (code, signal) => {
          log(`Lotus daemon exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
          this.process = null;
          this.ready = false;
          this.spawnedInternally = false;
        });

        this.process.on('error', (error) => {
          log(`Lotus process error (${this.lotusBinary}):`, error.message);
          this.process = null;
          this.spawnedInternally = false;
        });
      } catch (error) {
        this.spawnedInternally = false;
        log(`Failed to spawn Lotus binary "${this.lotusBinary}":`, error.message);
      }
    } else if (this.autoSpawn && !this.lotusBinary) {
      log('Auto-spawn enabled but no Lotus binary configured. Set FILECOIN_LOTUS_BINARY or disable auto spawn.');
    } else if (!this.autoSpawn) {
      log('Auto-spawn disabled; expecting external RPC endpoint.');
    }

    await this.waitForRpc();
    this.ready = true;
    log('Filecoin RPC is ready at', this.rpcUrl);
  }

  async waitForRpc() {
    const deadline = Date.now() + this.startTimeoutMs;
    let attempts = 0;

    while (Date.now() < deadline) {
      try {
        await this.chainHead();
        log('JSON-RPC endpoint responded to Filecoin.ChainHead');
        return;
      } catch (error) {
        attempts += 1;
        log(`RPC not reachable yet (attempt ${attempts}):`, error.message);
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
    log(`Stored snapshot ${fileName}${cid ? ` (cid: ${cid})` : ''}`);

    return {
      cid,
      path: filePath,
    };
  }

  async getStatus() {
    try {
      const head = await this.chainHead();
      const height = head?.Height ?? head?.Blocks?.[0]?.Height ?? null;
      const tipsetKeys = head?.Cids?.map((cid) => cid['/']).filter(Boolean) ?? [];
      return {
        ready: true,
        rpcUrl: this.rpcUrl,
        height,
        tipsetKeys,
        spawnedInternally: this.spawnedInternally,
      };
    } catch (error) {
      return {
        ready: false,
        rpcUrl: this.rpcUrl,
        spawnedInternally: this.spawnedInternally,
        error: error.message,
      };
    }
  }

  async stop() {
    if (this.process) {
      log('Stopping Lotus daemon');
      this.process.kill('SIGINT');
      this.process = null;
    }

    this.ready = false;
    this.spawnedInternally = false;
  }
}
