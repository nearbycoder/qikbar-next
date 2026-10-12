export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
      document.body.append(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

/**
 * Default router: click an existing link to the same href (so framework link
 * handlers run), otherwise click a temporary anchor (picked up by routers that
 * intercept anchor clicks, like SvelteKit, Astro, Nuxt, Turbo) or fall back to a
 * normal navigation.
 */
export function defaultNavigate(href: string, newTab: boolean) {
  if (newTab) {
    window.open(href, '_blank', 'noopener')
    return
  }
  const existing = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].find(
    (a) => a.getAttribute('href') === href && !a.closest('.qb-root') && (!a.target || a.target === '_self') && !a.hasAttribute('download'),
  )
  if (existing) {
    existing.click()
    return
  }
  const a = document.createElement('a')
  a.href = href
  a.style.display = 'none'
  document.body.append(a)
  a.click()
  a.remove()
}
