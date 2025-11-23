import { SubmarinoNode } from './submarino.js';

import { multiaddr, isMultiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';


const other = peerIdFromString('12D3KooWLCYWQogkHecgdQAhAwpZ1Rzuab6Zrnx1HcPo56HbX8Cs')

const node = new SubmarinoNode('.keys/mcp');


await node.start();

await node.node.dial(other)

