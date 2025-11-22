#!/usr/bin/env node
/**
 * Lightweight agent registry demo. No networking — it just instantiates agent
 * blueprints from JSON and shows how tasks would be routed.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_DATASET = path.join(ROOT, 'examples', 'llamaindex', 'sample_agents.json')

class AgentBlueprint {
  constructor({ title, capability, role, body }) {
    this.name = title
    this.role = role ?? 'unknown'
    this.capability = capability ?? 'general'
    this.summary = body ?? ''
  }
}

class AgentRegistry {
  constructor(agents) {
    this.agents = agents
    this.byCapability = new Map()

    for (const agent of agents) {
      const key = agent.capability
      if (!this.byCapability.has(key)) {
        this.byCapability.set(key, [])
      }
      this.byCapability.get(key).push(agent)
    }
  }

  listCapabilities() {
    return Array.from(this.byCapability.keys())
  }

  nextAgent(capability) {
    const candidates = this.byCapability.get(capability)
    if (!candidates || candidates.length === 0) {
      return null
    }
    return candidates[0]
  }

  plan(tasks) {
    return tasks.map((task) => {
      const handler = this.nextAgent(task.capability)
      return { ...task, handler }
    })
  }
}

function loadAgents(datasetPath = DEFAULT_DATASET) {
  const raw = fs.readFileSync(datasetPath, 'utf-8')
  const json = JSON.parse(raw)

  if (!Array.isArray(json)) {
    throw new Error('Agent dataset must be an array')
  }

  return json.map((item) => new AgentBlueprint(item))
}

function demo(tasks) {
  const registry = new AgentRegistry(loadAgents())
  console.log('\n=== Agent Registry Dry Run ===\n')
  console.log('Loaded capabilities:', registry.listCapabilities().join(', '))

  const plan = registry.plan(tasks)
  for (const step of plan) {
    if (!step.handler) {
      console.log(`- ${step.capability} -> no handler found`)
      continue
    }

    console.log(
      `- ${step.capability} (${JSON.stringify(step.context ?? {})}) -> ${step.handler.name}`
    )
  }

  console.log(
    '\nThis is a dry run (no networking). Integrate the plan with your messaging layer when ready.\n'
  )
}

function main() {
  const tasks = [
    { capability: 'multiply', context: { operands: [6, 7] } },
    {
      capability: 'sum',
      context: { operands: ['<product>', 5], dependsOn: 'multiply' },
    },
  ]

  demo(tasks)
}

main()
