#!/usr/bin/env node
/**
 * Spawns a local trio of agents (Actor, Multiplier, Adder) using SubmarinoNode.
 * This is a dry-run server that demonstrates peer discovery and task routing
 * without the full MCP stack.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline/promises'
import process from 'node:process'
import { SubmarinoNode } from '../submarino.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const createRequestId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`

class BaseAgent {
  constructor(name, keyPath) {
    this.name = name
    this.keyPath = keyPath
    this.node = new SubmarinoNode(keyPath)
    this.cleanupFns = []
  }

  async start() {
    await this.node.start()
    console.log(`[${this.name}] Peer ID ${this.node.peerId}`)
  }

  async stop() {
    while (this.cleanupFns.length) {
      const cleanup = this.cleanupFns.pop()
      try {
        cleanup()
      } catch (error) {
        console.error(`[${this.name}] Cleanup failed`, error)
      }
    }

    if (this.node?.node) {
      await this.node.stop()
    }
  }

  onMessage(handler) {
    const remove = this.node.onMessage(handler)
    this.cleanupFns.push(remove)
  }

  async send(to, payload) {
    await this.node.sendMessage([to], {
      ...payload,
      from: this.node.peerId,
    })
  }
}

class ComputeAgent extends BaseAgent {
  constructor(name, keyPath, capability, operate) {
    super(name, keyPath)
    this.capability = capability
    this.operate = operate
  }

  async start() {
    await super.start()
    this.onMessage(async (envelope) => {
      const payload = envelope.payload
      if (payload?.type !== 'task' || payload.capability !== this.capability) {
        return
      }

      if (!payload.replyTo) {
        console.warn(`[${this.name}] Missing replyTo for ${payload.requestId}`)
        return
      }

      const result = await this.operate(payload.operands ?? [], payload)
      console.log(`[${this.name}] ${this.capability}(${payload.operands}) -> ${result}`)

      await this.send(payload.replyTo, {
        type: 'task_result',
        capability: this.capability,
        requestId: payload.requestId,
        result,
        trace: [...(payload.trace ?? []), this.capability],
      })
    })
  }
}

class ActorAgent extends BaseAgent {
  constructor(name, keyPath) {
    super(name, keyPath)
    this.pending = new Map()
  }

  async start() {
    await super.start()
    this.onMessage((envelope) => {
      const payload = envelope.payload
      if (payload?.type !== 'task_result') {
        return
      }

      const pending = this.pending.get(payload.requestId)
      if (!pending) {
        return
      }

      clearTimeout(pending.timeout)
      this.pending.delete(payload.requestId)
      pending.resolve(payload)
    })
  }

  waitForResult(requestId, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`Timed out for ${requestId}`))
      }, timeoutMs)
      this.pending.set(requestId, { resolve, reject, timeout })
    })
  }
}

async function wireKnownPeers(actor, multiplier, adder) {
  const actorAddrs = actor.node.node.getMultiaddrs()
  const multiplierAddrs = multiplier.node.node.getMultiaddrs()
  const adderAddrs = adder.node.node.getMultiaddrs()

  await Promise.all([
    actor.node.addKnownPeer(multiplier.node.peerId, multiplierAddrs),
    actor.node.addKnownPeer(adder.node.peerId, adderAddrs),
    multiplier.node.addKnownPeer(actor.node.peerId, actorAddrs),
    adder.node.addKnownPeer(actor.node.peerId, actorAddrs),
  ])
}

async function runDemo() {
  const actor = new ActorAgent('Actor', path.join('.keys', 'actor-test'))
  const multiplier = new ComputeAgent(
    'Multiplier',
    path.join('.keys', 'multiplier-test'),
    'multiply',
    (operands) => operands[0] * operands[1]
  )
  const adder = new ComputeAgent(
    'Adder',
    path.join('.keys', 'adder-test'),
    'sum',
    (operands) => operands.reduce((acc, value) => acc + value, 0)
  )

  await Promise.all([actor.start(), multiplier.start(), adder.start()])
  await wireKnownPeers(actor, multiplier, adder)

  console.log('\nAgents wired. Waiting for peer discovery...')
  await wait(1000)

  const multiplyRequest = createRequestId()
  await actor.send(multiplier.node.peerId, {
    type: 'task',
    capability: 'multiply',
    operands: [3, 9],
    requestId: multiplyRequest,
    replyTo: actor.node.peerId,
    trace: ['actor'],
  })
  const multiplyResult = await actor.waitForResult(multiplyRequest)
  console.log('[Actor] multiply result:', multiplyResult.result)

  const sumRequest = createRequestId()
  await actor.send(adder.node.peerId, {
    type: 'task',
    capability: 'sum',
    operands: [multiplyResult.result, 5],
    requestId: sumRequest,
    replyTo: actor.node.peerId,
    trace: [...(multiplyResult.trace ?? []), 'sum'],
  })
  const sumResult = await actor.waitForResult(sumRequest)
  console.log('[Actor] final result:', sumResult.result)

  return { actor, multiplier, adder }
}

async function main() {
  const { actor, multiplier, adder } = await runDemo()

  console.log('\nPress ENTER to stop agents.')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  await rl.question('')
  rl.close()

  await Promise.all([actor.stop(), multiplier.stop(), adder.stop()])
}

main().catch((error) => {
  console.error('Agent test server failed:', error)
  process.exit(1)
})

