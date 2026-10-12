---
title: Arguments
description: Ask for a value or two inline, right in the search bar, before a command runs.
group: Core Concepts
order: 6
---

Some commands need a quick input: a language, a name, an amount. Instead of opening a form, declare `arguments`. Qikbar then shows inline fields in the search bar, like Raycast:

```ts
{
  title: 'Translate',
  icon: 'languages',
  arguments: [
    { name: 'text', placeholder: 'Text', required: true },
    { name: 'to', placeholder: 'Language', type: 'dropdown', options: [
      { title: 'French', value: 'fr' },
      { title: 'Spanish', value: 'es' },
    ] },
  ],
  run: (ctx) => translate(ctx.arguments.text, ctx.arguments.to),
}
```

Select the command and press <kbd>↵</kbd> or <kbd>Tab</kbd>. The fields appear and the first one is focused. <kbd>Tab</kbd> moves between fields, <kbd>↵</kbd> runs the command, and <kbd>Esc</kbd> cancels.

| Field | Description |
| --- | --- |
| `name` | **Required.** The key in `ctx.arguments`. |
| `placeholder` | The label shown in the field. |
| `type` | `text` (default), `password` or `dropdown`. |
| `required` | Blocks running until the field is filled. |
| `options` | `{ title, value }[]` for dropdowns. |

When the AI runs a command, it fills in the arguments itself.

> [!TIP]
> Need more than two or three inputs, or validation? Use a [form view](/docs/views#form).
