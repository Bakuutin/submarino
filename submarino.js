import { existsSync } from 'fs';
import { join } from 'path';

import { mkdir, readFile, writeFile } from 'fs/promises'
import { generateKeyPair, privateKeyToProtobuf, privateKeyFromProtobuf } from '@libp2p/crypto/keys'
import { peerIdFromPrivateKey, peerIdFromString } from '@libp2p/peer-id'
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { mdns } from "@libp2p/mdns";
import { tcp } from "@libp2p/tcp";
import defaultsDeep from "@nodeutils/defaults-deep";
import { createLibp2p as create } from "libp2p";
import { lpStream } from "@libp2p/utils";
import { toString as uint8ArrayToString } from "uint8arrays/to-string";
import { TypedEventEmitter } from '@libp2p/interface';
import { serviceCapabilities, serviceDependencies } from '@libp2p/interface';
import { pbStream } from 'it-protobuf-stream';
import { identify } from '@libp2p/identify';
import { dm } from './direct-message.js';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { ping } from '@libp2p/ping'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { sha256 } from 'multiformats/hashes/sha2'




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

// DirectMessage service constants
const DIRECT_MESSAGE_PROTOCOL = '/universal-connectivity/dm/1.0.0';
const MIME_TEXT_PLAIN = 'text/plain';
const dmClientVersion = '0.0.1';
const directMessageEvent = 'message';

const ERRORS = {
  EMPTY_MESSAGE: 'Message cannot be empty',
  NO_CONNECTION: 'Failed to create connection',
  NO_STREAM: 'Failed to create stream',
  NO_RESPONSE: 'No response received',
  NO_METADATA: 'No metadata in response',
  STATUS_NOT_OK: (status) => `Received status: ${status}, expected OK`,
};

// DirectMessage service class
class DirectMessage extends TypedEventEmitter {
  [serviceDependencies] = [
    '@libp2p/identify',
    '@libp2p/connection-encryption',
    '@libp2p/transport',
    '@libp2p/stream-multiplexing',
  ];

  [serviceCapabilities] = ['@universal-connectivity/direct-message'];

  constructor(components) {
    super();
    this.components = components;
    this.topologyId = undefined;
    this.dmPeers = new Set();
  }

  async start() {
    this.topologyId = await this.components.registrar.register(DIRECT_MESSAGE_PROTOCOL, {
      onConnect: this.handleConnect.bind(this),
      onDisconnect: this.handleDisconnect.bind(this),
    });
  }

  async afterStart() {
    await this.components.registrar.handle(DIRECT_MESSAGE_PROTOCOL, async ({ stream, connection }) => {
      await this.receive(stream, connection);
    });
  }

  stop() {
    if (this.topologyId != null) {
      this.components.registrar.unregister(this.topologyId);
    }
  }

  handleConnect(peerId) {
    this.dmPeers.add(peerId.toString());
  }

  handleDisconnect(peerId) {
    this.dmPeers.delete(peerId.toString());
  }

  isDMPeer(peerId) {
    return this.dmPeers.has(peerId.toString());
  }

  async send(peerId, message) {
    if (!message) {
      throw new Error(ERRORS.EMPTY_MESSAGE);
    }

    let stream;

    try {
      // openConnection will return the current open connection if it already exists, or create a new one
      const conn = await this.components.connectionManager.openConnection(peerId, { signal: AbortSignal.timeout(5000) });
      if (!conn) {
        throw new Error(ERRORS.NO_CONNECTION);
      }

      // Single protocols can skip full negotiation
      stream = await conn.newStream(DIRECT_MESSAGE_PROTOCOL, {
        negotiateFully: false,
      });

      if (!stream) {
        throw new Error(ERRORS.NO_STREAM);
      }

      const datastream = pbStream(stream);

      const req = {
        content: message,
        type: MIME_TEXT_PLAIN,
        metadata: {
          clientVersion: dmClientVersion,
          timestamp: BigInt(Date.now()),
        },
      };

      const signal = AbortSignal.timeout(5000);

      await datastream.write(req, dm.DirectMessageRequest, { signal });

      const res = await datastream.read(dm.DirectMessageResponse, { signal });

      if (!res) {
        throw new Error(ERRORS.NO_RESPONSE);
      }

      if (!res.metadata) {
        throw new Error(ERRORS.NO_METADATA);
      }

      if (res.status !== dm.Status.OK) {
        throw new Error(ERRORS.STATUS_NOT_OK(res.status));
      }
    } catch (e) {
      stream?.abort(e);
      throw e;
    } finally {
      try {
        await stream?.close({
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        stream?.abort(err);
        throw err;
      }
    }

    return true;
  }

  async receive(stream, connection) {
    try {
      const datastream = pbStream(stream);

      const signal = AbortSignal.timeout(5000);

      const req = await datastream.read(dm.DirectMessageRequest, { signal });

      const res = {
        status: dm.Status.OK,
        metadata: {
          clientVersion: dmClientVersion,
          timestamp: BigInt(Date.now()),
        },
      };

      await datastream.write(res, dm.DirectMessageResponse, { signal });

      const detail = {
        content: req.content,
        type: req.type,
        stream: stream,
        connection: connection,
      };

      this.dispatchEvent(new CustomEvent(directMessageEvent, { detail }));
    } catch (e) {
      stream?.abort(e);
      throw e;
    } finally {
      try {
        await stream?.close({
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        stream?.abort(err);
        throw err;
      }
    }
  }
}

// DirectMessage service factory function
function directMessage() {
  return (components) => {
    return new DirectMessage(components);
  };
}

// message IDs are used to dedupe inbound messages
// every agent in network should use the same message id function
async function msgIdFnStrictNoSign(msg) {
  const enc = new TextEncoder();
  const signedMessage = msg;
  const encodedSeqNum = enc.encode(signedMessage.sequenceNumber.toString());
  return await sha256.encode(encodedSeqNum);
}

export async function createLibp2p(_options) {
  const defaults = {
    transports: [tcp()],
    streamMuxers: [yamux()],
    connectionEncrypters: [noise()],
    peerDiscovery: [
      mdns({
      interval: 20e3,
    }),
    pubsubPeerDiscovery({
      interval: 10_000,
      topics: ['submarino-peer-discovery'],
      listenOnly: false
    })
  ],
    services: {
      pubsub: gossipsub({
        allowPublishToZeroTopicPeers: true,
        msgIdFn: msgIdFnStrictNoSign,
        ignoreDuplicatePublishError: true,
      }),
      identify: identify(),
      directMessage: directMessage(),
      ping: ping(),
    },
  };

  return create(defaultsDeep(_options, defaults));
}

class SubmarinoNode {
  constructor(keyPath) {
    this.keyPath = keyPath;
    this.knownPeers = new Map(); // peerId -> Set(...multiaddr)
    this.inbox = [];
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
    
    // Auto-dial discovered peers to establish connection
    if (this.node) {
      Promise.resolve().then(async () => {
        try {
          if (multiaddrs && multiaddrs.length > 0) {
            await this.node.dial(multiaddrs);
          } else if (id) {
            await this.node.dial(id);
          }
        } catch (err) {
          // Ignore dial errors - peer might already be connected or unreachable
        }
      });
    }
  }

  async sendMessage(to, message) {
    try {
      // Convert to PeerId if it's a string
      const peerId = typeof to === 'string' ? peerIdFromString(to) : to;
      
      // Convert message to string if it's an object
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      
      await this.node.services.directMessage.send(peerId, messageStr);
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  onDirectMessage(evt) {
    const { content, connection } = evt.detail;
    const peerId = connection.remotePeer.toString();
    console.log(`Received direct message from ${peerId}: ${content}`);
    this.inbox.push({
      from: peerId,
      content: content,
    });
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
    privKey: Buffer.from(keyBytes).toString('base64')
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
        listen: ["/ip4/0.0.0.0/tcp/0"],
      },
      privateKey: await this.getOrCreatePrivateKey(),
    });

    // Subscribe to pubsub discovery topic so we can discover peers via pubsub
    if (this.node.services.pubsub) {
      this.node.services.pubsub.subscribe('submarino-peer-discovery');
    }

    this.node.addEventListener(
      "peer:discovery",
      this.onPeerDiscovery.bind(this)
    );

    // Listen for direct messages
    this.node.services.directMessage.addEventListener(
      directMessageEvent,
      this.onDirectMessage.bind(this)
    );
    
    console.log('Node started, peer ID:', this.node.peerId.toString());
    console.log('Listening on:', this.node.getMultiaddrs().map(m => m.toString()));
  }
}

export { SubmarinoNode };
