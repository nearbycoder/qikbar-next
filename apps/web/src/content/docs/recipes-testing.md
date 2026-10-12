---
title: Testing
description: Unit test commands and extensions, run DOM tests with happy-dom, and drive the bar in Playwright.
group: Recipes
order: 7
label: Testing
---

## Unit test commands

Commands and extensions are plain objects. Call them with a fake context:

```ts title="commands.test.ts"
import { describe, expect, it, vi } from 'vitest'
import type { Context } from 'qikbar'
import { deployCommand } from './commands'

const fakeCtx = (overrides: Partial<Context> = {}): Context =>
  ({
    query: '',
    signal: new AbortController().signal,
    arguments: {},
    preferences: {},
    storage: { get: () => undefined, set: () => {}, remove: () => {} },
    toast: vi.fn(() => ({ update: vi.fn(), hide: vi.fn() })),
    confirm: vi.fn(async () => true),
    navigate: vi.fn(),
    ...overrides,
  }) as unknown as Context

it('deploys after confirmation', async () => {
  const ctx = fakeCtx()
  await deployCommand.run!(ctx)
  expect(ctx.confirm).toHaveBeenCalled()
  expect(ctx.toast).toHaveBeenCalledWith(expect.objectContaining({ style: 'loading' }))
})
```

## DOM tests

Qikbar runs in happy-dom and jsdom. Open it, type, press keys:

```ts title="command-bar.test.ts"
import { createQikbar } from 'qikbar'

it('finds and runs a command', async () => {
  const run = vi.fn()
  const bar = createQikbar({ commands: [{ title: 'Export CSV', run }] })
  await bar.preload()
  bar.open({ query: 'export' })
  await new Promise((r) => setTimeout(r, 0))
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await new Promise((r) => setTimeout(r, 0))
  expect(run).toHaveBeenCalled()
  bar.destroy()
})
```

## Playwright

The markup is accessible, so role-based locators work:

```ts title="e2e/command-bar.spec.ts"
import { expect, test } from '@playwright/test'

test('navigate with the command bar', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('combobox', { name: 'Search' })
  await search.fill('billing')
  await expect(page.getByRole('option', { name: /Billing/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/settings\/billing/)
})
```

> [!TIP]
> Call `bar.preload()` in tests so the UI chunk loads before you interact. Otherwise the first `open()` waits for the lazy import.
