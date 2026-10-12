import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/ui/markdown'

describe('renderMarkdown', () => {
  it('escapes HTML', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)> **bold**')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img')
    expect(html).toContain('<strong>bold</strong>')
  })

  it('blocks javascript: links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('click')
  })

  it('renders headings, lists, code and tables', () => {
    const html = renderMarkdown('# Title\n\n- one\n- two\n\n1. a\n2. b\n\n```ts\nconst x = 1 < 2\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>')
    expect(html).toContain('<ol><li>a</li><li>b</li></ol>')
    expect(html).toContain('const x = 1 &lt; 2')
    expect(html).toContain('<table>')
  })

  it('renders inline code without formatting inside', () => {
    expect(renderMarkdown('use `**not bold**`')).toContain('<code>**not bold**</code>')
  })

  it('autolinks urls', () => {
    expect(renderMarkdown('see https://qikbar.com.')).toContain('<a href="https://qikbar.com"')
  })
})
