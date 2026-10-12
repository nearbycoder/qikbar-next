---
title: Inline mode
description: Embed Qikbar directly in a page, as a search page, a launcher, or a live demo.
group: Customization
order: 3
---

By default Qikbar is a modal. Set `inline` to render it inside an element, always open:

```html
<div id="launcher"></div>
```

```ts
createQikbar({
  inline: '#launcher', // or an HTMLElement
  hotkey: false,       // or keep it: the hotkey focuses the input
  commands,
})
```

In inline mode:

- No overlay, no scroll lock and no focus trap. The bar sits in normal page flow and fills its container's width.
- The search input isn't focused automatically, so it doesn't steal focus on page load.
- <kbd>Esc</kbd> at the root clears the search and blurs. `close()` resets to the root view.
- `data-qikbar-open` triggers only open inline bars that target them by `namespace`: `data-qikbar-open="my-namespace"`.

The homepage demos on this site are inline bars.

## Several bars on one page

Give each instance its own `namespace`, so their storage and recents stay separate. Turn off global shortcuts on secondary bars:

```ts
createQikbar({ inline: '#demo', namespace: 'demo', hotkey: false, shortcuts: false, commands: demoCommands })
```

## In React

```tsx
<Qikbar inline commands={commands} className="h-[480px]" />
```
