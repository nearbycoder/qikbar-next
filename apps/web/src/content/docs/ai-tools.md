---
title: AI tools
description: Give the model functions it can call, with JSON-schema parameters and optional user confirmation.
group: AI
order: 4
---

Out of the box, the model can `search` and `run` everything in your bar, and `read_page`. Add your own **tools** for operations that don't fit a command, or that need structured arguments.

```ts
import { createQikbar, defineTool } from 'qikbar'

const inviteTeammate = defineTool<{ email: string; role: 'member' | 'admin' }>({
  name: 'invite_teammate',
  description: 'Invite someone to the current workspace by email.',
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: 'Their email address' },
      role: { type: 'string', enum: ['member', 'admin'] },
    },
    required: ['email'],
  },
  confirm: (args) => `Invite ${args.email} as ${args.role ?? 'member'}?`,
  async run({ email, role = 'member' }, ctx) {
    await api.invite(email, role)
    return `Invited ${email} as ${role}.`
  },
})

createQikbar({ ai: proxy('/api/qikbar'), tools: [inviteTeammate] })
```

Now “invite sam@acme.co as an admin” works.

## Tool fields

| Field | Description |
| --- | --- |
| `name` | `snake_case`, unique. Extension tools are prefixed with `extension__`. |
| `description` | What the tool does and when to use it. The model reads this, so be specific. |
| `parameters` | A JSON Schema object for the arguments. |
| `confirm` | `true`, or a function that returns a question. The user must approve before the tool runs. |
| `run(args, ctx)` | Do the work. The return value (string or JSON) is sent back to the model. Throwing reports an error to the model, which can recover. |

## Tips

- **Return useful results.** Return ids, counts and what changed, not just “ok”. The model uses the result to answer.
- **Confirm anything destructive or external**: deleting, sending, paying.
- **Keep the list short.** A few precise tools work better than dozens of vague ones. Commands are already available through `run`.
- Results longer than 12,000 characters are truncated.

## Commands vs tools

| Use a command when… | Use a tool when… |
| --- | --- |
| Users would also run it from the bar | Only the AI needs it |
| It takes no input, or one or two [arguments](/docs/arguments) | It needs structured, typed parameters |
| It navigates or opens a view | It returns data for the model to reason about |

## Tools in extensions

Extensions can ship tools too. They get the extension's preferences and storage in `ctx`. See [Extensions](/docs/extensions#ai-tools).
