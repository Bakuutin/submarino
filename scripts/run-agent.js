#!/usr/bin/env node
/**
 * Run a single agent role (actor, multiplier, adder) based on CLI/env config.
 * Designed for remote hosts so each server can run exactly one agent while
 * still collaborating over libp2p.
 */

import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline/promises'
import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { SubmarinoNode } from '../submarino.js'

const ROLE_DEFS = {
  actor: { kind: 'actor' },
  multiplier: {
    kind: 'compute',
    capability: 'multiply',
    operate: (operands) => {
      if (operands.length !== 2) {
        throw new Error('multiply requires exactly 2 operands')
      }
      return operands[0] * operands[1]
    },
  },
  adder: {
    kind: 'compute',
    capability: 'sum',
    operate: (operands) => operands.reduce((acc, value) => acc + value, 0),
  },
}

const DEFAULT_OPERANDS = [6, 7]
const DEFAULT_SAMPLE_DELAY = 2000

const wait = (ms) => delay(ms)
const createRequestId = () =>
  `${Date.now()}-${randomBytes(4).toString('hex')}`

const parseArgs = (argv) => {
  const result = { peers: [], sample: undefined, operands: undefined }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--role') {
      result.role = argv[++i]
    } else if (arg === '--peer') {
      result.peers.push(argv[++i])
    } else if (arg === '--sample') {
      result.sample = true
    } else if (arg === '--no-sample') {
      result.sample = false
    } else if (arg === '--operands') {
      result.operands = argv[++i]
    }
  }

  return result
}

const parseOperands = (value) => {
  if (!value) {
    return DEFAULT_OPERANDS
  }

  if (Array.isArray(value)) {
    return value
  }

  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num) && !Number.isNaN(num))
}

const parsePeerEntry = (entry) => {
  if (!entry) {
    return null
  }

  const normalized = entry.trim()
  if (!normalized) {
    return null
  }

  let label = null
  let rest = normalized
  const separatorIndex = normalized.indexOf('=')
  if (separatorIndex > -1) {
    label = normalized.slice(0, separatorIndex).trim()
    rest = normalized.slice(separatorIndex + 1)
  }

  const [peerIdPart, addrPart] = rest.split('@')
  const peerId = peerIdPart?.trim()
  if (!peerId) {
    throw new Error(`Invalid peer entry "${entry}" - missing peerId`)
  }

  const addresses = addrPart
    ? addrPart
        .split('|')
        .map((val) => val.trim())
        .filter(Boolean)
    : []

  return { label, peerId, addresses }
}

const collectPeerEntries = (cliPeers, envPeers) => {
  const entries = []
  const envList = envPeers
    ? envPeers
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : []

  for (const value of [...cliPeers, ...envList]) {
    const parsed = parsePeerEntry(value)
    if (parsed) {
      entries.push(parsed)
    }
  }

  return entries
}

const buildCapabilityTargets = (entries) => {
  const map = new Map()
  for (const entry of entries) {
    if (entry.label) {
      map.set(entry.label, entry.peerId)
    }
  }
  return map
}

const waitForResult = (state, requestId, timeoutMs = 15_000) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      state.pending.delete(requestId)
      reject(new Error(`Timed out waiting for ${requestId}`))
    }, timeoutMs)

    state.pending.set(requestId, {
      resolve: (payload) => {
        clearTimeout(timeout)
        resolve(payload)
      },
    })
  })

const createMessageHandler = (roleDef, state) => {
  if (roleDef.kind === 'compute') {
    return async (message) => {
      const payload = message.payload
      if (
        !payload ||
        payload.type !== 'task' ||
        payload.capability !== roleDef.capability
      ) {
        return
      }

      if (!payload.replyTo) {
        console.warn(
          `[${roleDef.capability}] Missing replyTo for request ${payload.requestId}`
        )
        return
      }

      try {
        const result = await roleDef.operate(payload.operands ?? [], payload)
        console.log(
          `[${roleDef.capability}] ${JSON.stringify(payload.operands)} -> ${result}`
        )

        await state.node.sendMessage(payload.replyTo, {
          type: 'task_result',
          capability: roleDef.capability,
          requestId: payload.requestId,
          result,
          trace: [...(payload.trace ?? []), roleDef.capability],
        })
      } catch (error) {
        console.error(
          `[${roleDef.capability}] Failed to process ${payload.requestId}`,
          error
        )
      }
    }
  }

  return (message) => {
    const payload = message.payload
    if (!payload || payload.type !== 'task_result') {
      return
    }

    const pending = state.pending.get(payload.requestId)
    if (!pending) {
      console.log('[actor] Received result with no pending handler', payload)
      return
    }

    state.pending.delete(payload.requestId)
    pending.resolve(payload)
  }
}

const registerPeers = async (node, entries) => {
  for (const entry of entries) {
    console.log(
      `[runner] trusting peer ${entry.peerId}${
        entry.label ? ` (label: ${entry.label})` : ''
      }`
    )
    await node.addKnownPeer(entry.peerId, entry.addresses)
  }
}

const pickTargetPeer = (state, capability) => {
  if (state.capabilityTargets.has(capability)) {
    return state.capabilityTargets.get(capability)
  }

  // fall back to first configured peer
  const fallback = state.allPeers.at(0)
  return fallback ? fallback.peerId : null
}

const runSampleTask = async (node, state, operands) => {
  const target = pickTargetPeer(state, 'multiply')
  if (!target) {
    console.warn('[actor] No peer configured for multiply, skipping sample task')
    return
  }

  const requestId = createRequestId()
  console.log(
    `[actor] sending multiply(${operands.join(', ')}) to peer ${target}`
  )
  const waitPromise = waitForResult(state, requestId)

  await node.sendMessage(target, {
    type: 'task',
    capability: 'multiply',
    operands,
    requestId,
    replyTo: node.peerId,
    trace: ['actor'],
  })

  try {
    const response = await waitPromise
    console.log(`[actor] result: ${response.result}`)
  } catch (error) {
    console.error('[actor] sample task failed:', error.message)
  }
}

const main = async () => {
  const argv = parseArgs(process.argv.slice(2))
  const role =
    argv.role ?? process.env.AGENT_ROLE ?? process.env.AGENT ?? 'actor'
  const roleDef = ROLE_DEFS[role]

  if (!roleDef) {
    console.error(
      `Unknown role "${role}". Choose from: ${Object.keys(ROLE_DEFS).join(', ')}`
    )
    process.exit(1)
  }

  const keyDir = process.env.AGENT_KEY_DIR ?? '.keys/agents'
  const keyPath = path.join(keyDir, role)
  const envPeers = process.env.AGENT_PEERS ?? ''
  const peerEntries = collectPeerEntries(argv.peers, envPeers)

  if (peerEntries.length === 0) {
    console.warn(
      '[runner] No peers configured yet. You can still start the agent and add peers later by editing trustedPeers.json.'
    )
  }

  const state = {
    pending: new Map(),
    capabilityTargets: buildCapabilityTargets(peerEntries),
    allPeers: peerEntries,
    node: null,
  }

  const handler = createMessageHandler(roleDef, state)
  const node = new SubmarinoNode(keyPath, handler)
  state.node = node

  await node.start()
  await registerPeers(node, peerEntries)

  console.log(`\n[runner] ${role} agent ready`)
  console.log(`         peer id: ${node.peerId}`)
  console.log(
    `         listening on:\n${node
      .getMultiaddrs()
      .map((addr) => `           - ${addr.toString()}`)
      .join('\n')}`
  )

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) {
      return
    }
    shuttingDown = true
    console.log('\n[runner] stopping agent...')
    await node.stop().catch(() => {})
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  if (roleDef.kind === 'actor') {
    const operands =
      parseOperands(argv.operands ?? process.env.AGENT_OPERANDS) ??
      DEFAULT_OPERANDS
    const shouldSample =
      argv.sample ??
      (process.env.AGENT_AUTO_SAMPLE === undefined ||
        process.env.AGENT_AUTO_SAMPLE === '1')

    if (shouldSample) {
      const delayMs = Number(process.env.AGENT_SAMPLE_DELAY ?? DEFAULT_SAMPLE_DELAY)
      await wait(delayMs)
      await runSampleTask(node, state, operands)
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    const prompt = 'Press ENTER to run the sample task again (Ctrl+C to exit): '
    rl.setPrompt(prompt)
    rl.prompt()

    rl.on('line', async () => {
      await runSampleTask(node, state, operands)
      rl.prompt()
    })
  } else {
    console.log(`[runner] waiting for ${roleDef.capability} tasks...`)
  }
}

await main().catch((error) => {
  console.error('[runner] fatal error:', error)
  process.exit(1)
})


