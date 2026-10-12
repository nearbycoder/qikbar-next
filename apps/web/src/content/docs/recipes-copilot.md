---
title: In-app AI copilot
description: Turn the bar into a copilot that understands your domain and takes real actions.
group: Recipes
order: 6
label: AI copilot
---

This recipe builds a copilot for an invoicing app. Users can say “create an invoice for Acme for $1,200 due next Friday” or “which invoices are overdue?”.

## 1. The server route

```ts title="app/api/qikbar/route.ts"
import { createHandler, anthropic } from '@qikbar/qikbar/server'
import { auth } from '@/auth'

export const POST = createHandler({
  provider: anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, effort: 'medium' }),
  system: 'You help small businesses manage invoices in Ledgerly. Amounts are in the workspace currency.',
  maxTokens: 4000,
  authorize: async () => !!(await auth()),
})
```

## 2. Domain tools

Tools run in the browser with the user's session, calling your existing API:

```ts title="command-bar/tools.ts"
import { defineTool } from '@qikbar/qikbar'

export const findInvoices = defineTool<{ status?: 'draft' | 'sent' | 'paid' | 'overdue'; customer?: string }>({
  name: 'find_invoices',
  description: 'List invoices, optionally filtered by status or customer name. Returns number, customer, amount, due date and status.',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['draft', 'sent', 'paid', 'overdue'] },
      customer: { type: 'string' },
    },
  },
  run: (args) => api.invoices.list(args),
})

export const createInvoice = defineTool<{ customer: string; amount: number; due: string; memo?: string }>({
  name: 'create_invoice',
  description: 'Create a draft invoice. `due` is an ISO date. Resolve relative dates like "next Friday" yourself.',
  parameters: {
    type: 'object',
    properties: {
      customer: { type: 'string' },
      amount: { type: 'number' },
      due: { type: 'string', description: 'YYYY-MM-DD' },
      memo: { type: 'string' },
    },
    required: ['customer', 'amount', 'due'],
  },
  confirm: (a) => `Create a $${a.amount} invoice for ${a.customer}, due ${a.due}?`,
  async run(args) {
    const invoice = await api.invoices.create(args)
    // The model links to it in its answer; the user stays in the chat.
    return { id: invoice.id, number: invoice.number, url: `/invoices/${invoice.id}` }
  },
})
```

## 3. Wire it up

```ts
createQikbar({
  routes,
  commands,
  sources: [customersSource, invoicesSource],
  tools: [findInvoices, createInvoice],
  ai: {
    provider: proxy('/api/qikbar'),
    name: 'Ledgerly AI',
    system: `Today is ${new Date().toDateString()}.`,
    suggestions: ['Which invoices are overdue?', 'Create an invoice for Acme', 'Go to reports'],
  },
})
```

## Why this works well

- **Your commands are already tools.** The model can navigate to any route or run any command through the built-in `run` tool. You only add tools for things that need parameters.
- **Your sources are already searchable.** “Open the Acme customer” works through the built-in `search` tool.
- **Writes are confirmed.** `confirm` asks the user before anything is created.
- **Keys stay server-side.** The browser only talks to your route.

> [!TIP]
> Return structured results from tools (ids, counts, URLs). The model uses them to write accurate answers and links.
