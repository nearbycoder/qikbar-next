---
title: Vanilla, Angular & more
description: Use Qikbar with no framework, a script tag, Angular, Solid, htmx, Rails, Django or Laravel.
group: Frameworks
order: 5
---

## No build step

```html
<script src="https://unpkg.com/qikbar/dist/qikbar.global.js"></script>
<script>
  const { createQikbar, extensions } = Qikbar
  createQikbar({
    autoIndex: true,
    extensions: [extensions.calculator(), extensions.themeSwitcher()],
    commands: [{ title: 'Contact support', icon: 'mail', url: 'mailto:help@acme.co' }],
  })
</script>
```

With `autoIndex`, server-rendered apps (Rails, Django, Laravel, Phoenix, WordPress, plain HTML) get a working command bar with no JavaScript config. Qikbar reads your navigation links and any element with `data-qikbar`:

```html
<nav aria-label="Account">
  <a href="/account">Account</a>
  <a href="/billing">Billing</a>
</nav>
<form action="/logout" method="post">
  <button data-qikbar="Log out" data-qikbar-icon="log-out">Log out</button>
</form>
```

## ES modules

```ts
import { createQikbar } from 'qikbar'

const bar = createQikbar({ routes, commands })
document.querySelector('#search')!.addEventListener('click', () => bar.open())
```

## Angular

```ts title="command-bar.service.ts"
import { Injectable, OnDestroy, inject } from '@angular/core'
import { Router } from '@angular/router'
import { createQikbar, type QikbarInstance } from 'qikbar'

@Injectable({ providedIn: 'root' })
export class CommandBarService implements OnDestroy {
  private router = inject(Router)
  readonly bar: QikbarInstance = createQikbar({
    navigate: (href) => this.router.navigateByUrl(href),
    routes: [{ path: '/dashboard', title: 'Dashboard', icon: 'home' }],
  })
  ngOnDestroy() {
    this.bar.destroy()
  }
}
```

Inject the service once in your root component. For SSR, create the bar only in the browser (`isPlatformBrowser`).

## Solid

```tsx
import { onCleanup, onMount } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { createQikbar } from 'qikbar'

export function CommandBar() {
  const navigate = useNavigate()
  onMount(() => {
    const bar = createQikbar({ navigate: (href) => navigate(href), routes })
    onCleanup(() => bar.destroy())
  })
  return null
}
```

## htmx and Turbo

The default navigator clicks a temporary link, so `hx-boost` and Turbo Drive handle navigation for you. To trigger htmx requests from commands, use `htmx.ajax('GET', url, target)` in `run`.

## SSR safety

`createQikbar` is safe to call on the server. It does nothing until it runs in a browser. Still, prefer creating it in client-only code.
