import { existsSync } from 'fs';
import { join } from 'path';

import { mkdir, readFile, writeFile } from 'fs/promises'
import { generateKeyPair, privateKeyToProtobuf, privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { mdns } from "@libp2p/mdns";
import { tcp } from "@libp2p/tcp";
import defaultsDeep from "@nodeutils/defaults-deep";
import { createLibp2p as create } from "libp2p";
import { lpStream } from "@libp2p/utils";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";




export function stdinToStream(stream) {
  const lp = lpStream(stream);

  process.stdin.addListener("data", (buf) => {
    try {
      lp.write(buf);
    } catch (error) {
      return;
    }
  });
}

export function streamToConsole(stream) {
  const lp = lpStream(stream);

  Promise.resolve().then(async () => {
    while (true) {
      try {
        const message = await lp.read();
        console.log(
          "> " + uint8ArrayToString(message.subarray()).replace("\n", "")
        );
      } catch (error) {
        return;
      }
    }
  });
}

export async function createLibp2p(_options) {
  const defaults = {
    transports: [tcp()],
    streamMuxers: [yamux()],
    connectionEncrypters: [noise()],
    peerDiscovery: [mdns()],
  };

  return create(defaultsDeep(_options, defaults));
}

const PROTOCOL = "/submarino/1.0.0";

class SubmarinoNode {
  constructor(keyPath) {
    this.keyPath = keyPath;
    this.knownPeers = new Map(); // peerId -> Set(...multiaddr)
  }

  onPeerDiscovery(evt) {
    const {id, multiaddrs} = evt.detail;
    let knownAddresses = this.knownPeers.get(id);
    if (!knownAddresses) {
      knownAddresses = new Set();
      this.knownPeers.set(id.toString(), knownAddresses);
    }
    for (const multiaddr of multiaddrs) {
      knownAddresses.add(multiaddr);
    }
  }


  async onProtocolMessage(stream) {
    try {
      for await (const chunk of stream) {
        console.log("received a message: ", chunk);
      }
    } catch (error) {
      console.error("Error receiving message:", error);
    }
  }

  peerIdToAddresses(peerId) {
    const knownAddresses = this.knownPeers.get(peerId.toString());
    if (!knownAddresses) {
      throw new Error(`Unknown peer: ${peerId.toString()}`);
    }
    return Array.from(knownAddresses);
  }

  async sendMessage(to, message) {
    const addresses = this.peerIdToAddresses(to);
    for (const address of addresses) {
      const stream = await this.node.dialProtocol(address, PROTOCOL);
      stream.dispatchEvent(new Event("message", { detail: message }));
    }
  }

async getOrCreatePrivateKey() {
  const keyFile = join(this.keyPath, 'peer-id.json')

  // If file exists, try to load it
  if (existsSync(keyFile)) {
    try {
      const raw = await readFile(keyFile, 'utf8')
      const data = JSON.parse(raw)

      if (!data.privKey) {
        throw new Error('privKey missing in peer-id.json')
      }

      const keyBytes = Buffer.from(data.privKey, 'base64')
      const privateKey = await privateKeyFromProtobuf(keyBytes)
      return privateKey
    } catch (err) {
      console.warn('[libp2p] Failed to load existing peer-id.json, regenerating key:', err)
      // fall through to creation branch
    }
  }

  // Create dir if needed
  await mkdir(this.keyPath, { recursive: true })

  // Generate new key
  const privateKey = await generateKeyPair('Ed25519')
  const peerId = peerIdFromPrivateKey(privateKey)

  // Serialize key into protobuf bytes and store as base64 in JSON
  const keyBytes = privateKeyToProtobuf(privateKey)
  const payload = {
    id: peerId.toString(),              // for convenience/debugging
    privKey: keyBytes.toString('base64')
  }

  await writeFile(keyFile, JSON.stringify(payload, null, 2), 'utf8')

  return privateKey
}


  async start() {
    if (this.node) {
      return;
    }

    this.node = await createLibp2p({
      addresses: {
        listen: ["/ip4/127.0.0.1/tcp/0"],
      },
      privateKey: await this.getOrCreatePrivateKey(),
    });

    this.node.addEventListener(
      "peer:discovery",
      this.onPeerDiscovery.bind(this)
    );
    await this.node.handle(PROTOCOL, this.onProtocolMessage.bind(this));
  }
}

export { SubmarinoNode };

