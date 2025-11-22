import { randomBytes } from 'crypto'
import { NetworkNode } from './server.js'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const createRequestId = () => `${Date.now()}-${randomBytes(4).toString('hex')}`

class BaseAgent {
  constructor(name, keyPath) {
    this.name = name
    this.keyPath = keyPath
    this.node = new NetworkNode(keyPath)
    this.cleanupFns = []
  }

  async start() {
    await this.node.start()
    console.log(`[${this.name}] Peer ID: ${this.id}`)
  }

  async stop() {
    while (this.cleanupFns.length) {
      const cleanup = this.cleanupFns.pop()
      try {
        cleanup()
      } catch (error) {
        console.error(`[${this.name}] Failed to cleanup handler`, error)
      }
    }

    if (this.node) {
      await this.node.stop()
    }
  }

  get id() {
    return this.node.getPeerId()
  }

  onMessage(handler) {
    const remove = this.node.onMessage(handler)
    this.cleanupFns.push(remove)
  }

  async send(to, payload) {
    await this.node.sendMessage([to], {
      ...payload,
      from: this.id,
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
        console.warn(`[${this.name}] Received task without replyTo, ignoring`)
        return
      }

      try {
        const result = await this.operate(payload.operands ?? [], payload)
        console.log(`[${this.name}] ${this.capability} request ${payload.requestId} -> ${result}`)

        await this.send(payload.replyTo, {
          type: 'task_result',
          capability: this.capability,
          requestId: payload.requestId,
          result,
          trace: [...(payload.trace ?? []), this.capability],
        })
      } catch (error) {
        console.error(`[${this.name}] Failed to complete task ${payload.requestId}`, error)
      }
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

  waitForResult(requestId, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`Timed out waiting for result ${requestId}`))
      }, timeoutMs)

      this.pending.set(requestId, { resolve, reject, timeout })
    })
  }
}

async function main() {
  console.log('\n=== Simple Agents Demo ===')
  console.log(
    'Actor orchestrates a multiply task followed by a sum task using specialist peers.\n'
  )

  const actor = new ActorAgent('Actor', '.keys/actor')
  const multiplier = new ComputeAgent(
    'Multiplier',
    '.keys/multiplier',
    'multiply',
    (operands) => {
      if (operands.length !== 2) {
        throw new Error('Multiply requires exactly 2 operands')
      }

      return operands[0] * operands[1]
    }
  )
  const adder = new ComputeAgent(
    'Adder',
    '.keys/adder',
    'sum',
    (operands) => operands.reduce((acc, value) => acc + value, 0)
  )

  try {
    await Promise.all([actor.start(), multiplier.start(), adder.start()])

    const actorAddrs = actor.node.getMultiaddrs()
    const multiplierAddrs = multiplier.node.getMultiaddrs()
    const adderAddrs = adder.node.getMultiaddrs()

    await Promise.all([
      actor.node.addKnownPeer(multiplier.id, multiplierAddrs),
      actor.node.addKnownPeer(adder.id, adderAddrs),
      multiplier.node.addKnownPeer(actor.id, actorAddrs),
      adder.node.addKnownPeer(actor.id, actorAddrs),
    ])

    console.log('Waiting for agents to discover each other...')
    await wait(2000)

    const multiplyRequestId = createRequestId()
    console.log(`[Actor] Requesting multiply(6, 7) as ${multiplyRequestId}`)
    await actor.send(multiplier.id, {
      type: 'task',
      capability: 'multiply',
      operands: [6, 7],
      requestId: multiplyRequestId,
      replyTo: actor.id,
      trace: ['actor'],
    })

    const multiplyResult = await actor.waitForResult(multiplyRequestId)
    console.log(`[Actor] Multiply result: ${multiplyResult.result}`)

    const sumRequestId = createRequestId()
    console.log(
      `[Actor] Requesting sum(${multiplyResult.result}, 5) to finish the pipeline as ${sumRequestId}`
    )
    await actor.send(adder.id, {
      type: 'task',
      capability: 'sum',
      operands: [multiplyResult.result, 5],
      requestId: sumRequestId,
      replyTo: actor.id,
      dependsOn: multiplyRequestId,
      trace: [...(multiplyResult.trace ?? []), 'sum'],
    })

    const sumResult = await actor.waitForResult(sumRequestId)
    console.log(`[Actor] Final result (6 * 7 + 5): ${sumResult.result}`)
    console.log('Demo complete — press Ctrl+C to exit.\n')
  } catch (error) {
    console.error('Simple agent demo failed:', error)
  } finally {
    await Promise.all([actor.stop(), multiplier.stop(), adder.stop()])
    process.exit(0)
  }
}

main()
