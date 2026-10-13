---
title: Angular
description: Use Qikbar in Angular with the <qik-bar> element or a small injectable service.
group: Frameworks
order: 6
---

Angular works with Qikbar's [web component](/docs/web-component), or with the vanilla API in a service.

## The element

```ts title="src/main.ts"
import '@qikbar/qikbar/element'
```

```ts title="src/app/app.component.ts"
import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ViewChild, AfterViewInit, inject } from '@angular/core'
import { Router, RouterOutlet } from '@angular/router'
import type { QikbarElement } from '@qikbar/qikbar/element'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <qik-bar #bar launcher="touch" placeholder="Search Acme…">
      <qik-command href="/projects" section="Navigation" icon="folder">Projects</qik-command>
      <qik-command href="/settings" section="Navigation" icon="settings">Settings</qik-command>
      <qik-command (run)="toggleTheme()" icon="moon">Toggle theme</qik-command>
    </qik-bar>
    <router-outlet />
  `,
})
export class AppComponent implements AfterViewInit {
  private router = inject(Router)
  @ViewChild('bar') bar!: ElementRef<QikbarElement>

  ngAfterViewInit() {
    // Anything attributes can't express: navigation, sources, AI…
    this.bar.nativeElement.config = { navigate: (href) => this.router.navigateByUrl(href) }
  }

  toggleTheme() {
    document.documentElement.classList.toggle('dark')
  }
}
```

`<qik-command>` children become commands. Angular's `(run)` binding listens for the event the element fires when a command without an `href` runs.

## A service

For commands registered from many components, wrap the instance in a service:

```ts title="src/app/qikbar.service.ts"
import { Injectable, NgZone, OnDestroy, inject } from '@angular/core'
import { Router } from '@angular/router'
import { createQikbar, type Command } from '@qikbar/qikbar'

@Injectable({ providedIn: 'root' })
export class QikbarService implements OnDestroy {
  private router = inject(Router)
  private zone = inject(NgZone)

  readonly bar = this.zone.runOutsideAngular(() =>
    createQikbar({
      navigate: (href) => this.zone.run(() => this.router.navigateByUrl(href)),
      launcher: 'touch',
    }),
  )

  /** Register commands; call the returned function in ngOnDestroy. */
  register(commands: Command[]) {
    return this.bar.register(commands)
  }

  ngOnDestroy() {
    this.bar.destroy()
  }
}
```

```ts
export class ProjectComponent implements OnInit, OnDestroy {
  private qikbar = inject(QikbarService)
  private off?: () => void

  ngOnInit() {
    this.off = this.qikbar.register([{ title: 'Archive project', icon: 'trash', run: () => this.archive() }])
  }
  ngOnDestroy() {
    this.off?.()
  }
}
```

Creating the bar outside Angular's zone keeps its keyboard and pointer listeners from triggering change detection. Commands that change Angular state should re-enter the zone (`this.zone.run(...)`), as `navigate` does above.
