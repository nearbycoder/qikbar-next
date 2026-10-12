import type { ThemePresetName, ThemeVars } from '../core/types.js'

export interface ThemePreset {
  name: ThemePresetName
  label: string
  /** Used when only one appearance makes sense for the preset. */
  only?: 'light' | 'dark'
  light?: ThemeVars
  dark?: ThemeVars
}

/** Defaults (also defined in CSS, repeated here for the theme builder). */
export const baseLight: ThemeVars = {
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  fontSize: '14px',
  bg: 'rgba(255, 255, 255, 0.92)',
  bgElevated: '#ffffff',
  fg: '#18181b',
  fgMuted: '#52525b',
  fgSubtle: '#a1a1aa',
  border: 'rgba(0, 0, 0, 0.08)',
  selection: 'rgba(0, 0, 0, 0.055)',
  selectionFg: '#09090b',
  hover: 'rgba(0, 0, 0, 0.03)',
  accent: '#6d5dfc',
  accentFg: '#ffffff',
  highlight: '#6d5dfc',
  overlay: 'rgba(24, 24, 27, 0.18)',
  backdropBlur: '20px',
  shadow: '0 0 0 1px rgba(0,0,0,.04), 0 24px 64px -12px rgba(0,0,0,.25), 0 8px 24px -8px rgba(0,0,0,.12)',
  radius: '14px',
  radiusItem: '8px',
  width: '680px',
  listHeight: '380px',
  rowHeight: '42px',
  sectionHeight: '30px',
  inputHeight: '56px',
  inputFontSize: '16px',
  top: '14vh',
  kbdBg: 'rgba(0, 0, 0, 0.06)',
  kbdFg: '#52525b',
  danger: '#e5484d',
  success: '#30a46c',
  warning: '#f5a524',
}

export const baseDark: ThemeVars = {
  bg: 'rgba(28, 28, 31, 0.9)',
  bgElevated: '#232327',
  fg: '#f4f4f5',
  fgMuted: '#a1a1aa',
  fgSubtle: '#71717a',
  border: 'rgba(255, 255, 255, 0.09)',
  selection: 'rgba(255, 255, 255, 0.075)',
  selectionFg: '#ffffff',
  hover: 'rgba(255, 255, 255, 0.04)',
  accent: '#8b7dff',
  accentFg: '#ffffff',
  highlight: '#a99fff',
  overlay: 'rgba(0, 0, 0, 0.45)',
  shadow: '0 0 0 1px rgba(255,255,255,.04), 0 24px 64px -12px rgba(0,0,0,.6), 0 8px 24px -8px rgba(0,0,0,.4)',
  kbdBg: 'rgba(255, 255, 255, 0.08)',
  kbdFg: '#a1a1aa',
  danger: '#ff6369',
  success: '#3dd68c',
  warning: '#ffc53d',
}

export const presets: Record<ThemePresetName, ThemePreset> = {
  light: { name: 'light', label: 'Light', only: 'light' },
  dark: { name: 'dark', label: 'Dark', only: 'dark' },
  raycast: {
    name: 'raycast',
    label: 'Raycast',
    light: { accent: '#ff6363', highlight: '#ff6363', bg: 'rgba(250,250,250,.86)', radius: '12px', width: '750px', rowHeight: '40px' },
    dark: {
      accent: '#ff6363',
      highlight: '#ff6363',
      bg: 'rgba(30, 30, 30, .82)',
      bgElevated: '#2a2a2a',
      selection: 'rgba(255,255,255,.1)',
      border: 'rgba(255,255,255,.1)',
      radius: '12px',
      width: '750px',
      rowHeight: '40px',
    },
  },
  linear: {
    name: 'linear',
    label: 'Linear',
    light: { accent: '#5e6ad2', highlight: '#5e6ad2', bg: '#ffffff', selection: '#f2f2f5', radius: '10px', fontSize: '13px', inputFontSize: '15px', rowHeight: '40px' },
    dark: {
      accent: '#5e6ad2',
      highlight: '#8d95f2',
      bg: 'rgba(25, 26, 35, .96)',
      bgElevated: '#22232e',
      fg: '#eeeffc',
      fgMuted: '#9ea0b4',
      fgSubtle: '#6b6f85',
      selection: 'rgba(255,255,255,.06)',
      border: 'rgba(255,255,255,.07)',
      radius: '10px',
      fontSize: '13px',
      inputFontSize: '15px',
      rowHeight: '40px',
    },
  },
  vercel: {
    name: 'vercel',
    label: 'Vercel',
    light: { accent: '#000000', accentFg: '#fff', highlight: '#000', bg: '#ffffff', selection: '#f2f2f2', radius: '12px', fontSize: '14px', border: '#eaeaea' },
    dark: {
      accent: '#ffffff',
      accentFg: '#000',
      highlight: '#fff',
      bg: '#0a0a0a',
      bgElevated: '#111',
      fg: '#ededed',
      fgMuted: '#a1a1a1',
      fgSubtle: '#6e6e6e',
      selection: '#1f1f1f',
      border: '#262626',
      radius: '12px',
    },
  },
  github: {
    name: 'github',
    label: 'GitHub',
    light: { accent: '#0969da', highlight: '#0969da', bg: '#ffffff', selection: '#f6f8fa', fg: '#1f2328', fgMuted: '#59636e', border: '#d1d9e0', radius: '12px', radiusItem: '6px' },
    dark: {
      accent: '#4493f8',
      highlight: '#4493f8',
      bg: '#151b23',
      bgElevated: '#212830',
      fg: '#f0f6fc',
      fgMuted: '#9198a1',
      fgSubtle: '#656c76',
      selection: '#262c36',
      border: '#3d444d',
      radius: '12px',
      radiusItem: '6px',
    },
  },
  nord: {
    name: 'nord',
    label: 'Nord',
    light: { accent: '#5e81ac', highlight: '#5e81ac', bg: '#eceff4', bgElevated: '#e5e9f0', fg: '#2e3440', fgMuted: '#4c566a', selection: '#d8dee9', border: '#d8dee9' },
    dark: {
      accent: '#88c0d0',
      accentFg: '#2e3440',
      highlight: '#88c0d0',
      bg: '#2e3440',
      bgElevated: '#3b4252',
      fg: '#eceff4',
      fgMuted: '#d8dee9',
      fgSubtle: '#7b88a1',
      selection: '#3b4252',
      border: '#434c5e',
      kbdBg: '#434c5e',
      kbdFg: '#d8dee9',
    },
  },
  dracula: {
    name: 'dracula',
    label: 'Dracula',
    only: 'dark',
    dark: {
      accent: '#bd93f9',
      accentFg: '#282a36',
      highlight: '#ff79c6',
      bg: '#282a36',
      bgElevated: '#343746',
      fg: '#f8f8f2',
      fgMuted: '#c1c4d6',
      fgSubtle: '#6272a4',
      selection: '#44475a',
      border: '#44475a',
      kbdBg: '#44475a',
      kbdFg: '#f8f8f2',
      success: '#50fa7b',
      danger: '#ff5555',
      warning: '#f1fa8c',
    },
  },
  catppuccin: {
    name: 'catppuccin',
    label: 'Catppuccin',
    light: { accent: '#8839ef', highlight: '#8839ef', bg: '#eff1f5', bgElevated: '#e6e9ef', fg: '#4c4f69', fgMuted: '#6c6f85', fgSubtle: '#9ca0b0', selection: '#ccd0da', border: '#ccd0da' },
    dark: {
      accent: '#cba6f7',
      accentFg: '#1e1e2e',
      highlight: '#f5c2e7',
      bg: '#1e1e2e',
      bgElevated: '#313244',
      fg: '#cdd6f4',
      fgMuted: '#a6adc8',
      fgSubtle: '#6c7086',
      selection: '#313244',
      border: '#45475a',
      kbdBg: '#313244',
      kbdFg: '#bac2de',
    },
  },
  'tokyo-night': {
    name: 'tokyo-night',
    label: 'Tokyo Night',
    only: 'dark',
    dark: {
      accent: '#7aa2f7',
      accentFg: '#1a1b26',
      highlight: '#bb9af7',
      bg: '#1a1b26',
      bgElevated: '#24283b',
      fg: '#c0caf5',
      fgMuted: '#a9b1d6',
      fgSubtle: '#565f89',
      selection: '#292e42',
      border: '#2f344d',
      kbdBg: '#292e42',
      kbdFg: '#a9b1d6',
    },
  },
  'rose-pine': {
    name: 'rose-pine',
    label: 'Rosé Pine',
    light: { accent: '#907aa9', highlight: '#d7827e', bg: '#faf4ed', bgElevated: '#fffaf3', fg: '#575279', fgMuted: '#797593', fgSubtle: '#9893a5', selection: '#f2e9e1', border: '#dfdad9' },
    dark: {
      accent: '#c4a7e7',
      accentFg: '#191724',
      highlight: '#ebbcba',
      bg: '#191724',
      bgElevated: '#1f1d2e',
      fg: '#e0def4',
      fgMuted: '#908caa',
      fgSubtle: '#6e6a86',
      selection: '#26233a',
      border: '#26233a',
      kbdBg: '#26233a',
      kbdFg: '#908caa',
    },
  },
  solarized: {
    name: 'solarized',
    label: 'Solarized',
    light: { accent: '#268bd2', highlight: '#cb4b16', bg: '#fdf6e3', bgElevated: '#eee8d5', fg: '#586e75', fgMuted: '#657b83', fgSubtle: '#93a1a1', selection: '#eee8d5', border: '#e4ddc8' },
    dark: {
      accent: '#268bd2',
      highlight: '#b58900',
      bg: '#002b36',
      bgElevated: '#073642',
      fg: '#93a1a1',
      fgMuted: '#839496',
      fgSubtle: '#586e75',
      selection: '#073642',
      border: '#0a4352',
      kbdBg: '#073642',
      kbdFg: '#93a1a1',
    },
  },
  midnight: {
    name: 'midnight',
    label: 'Midnight',
    only: 'dark',
    dark: {
      accent: '#22d3ee',
      accentFg: '#020617',
      highlight: '#67e8f9',
      bg: 'rgba(2, 6, 23, .88)',
      bgElevated: '#0f172a',
      fg: '#e2e8f0',
      fgMuted: '#94a3b8',
      fgSubtle: '#475569',
      selection: 'rgba(34, 211, 238, .1)',
      selectionFg: '#a5f3fc',
      border: 'rgba(148, 163, 184, .14)',
      radius: '18px',
      radiusItem: '10px',
    },
  },
  paper: {
    name: 'paper',
    label: 'Paper',
    only: 'light',
    light: {
      font: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
      accent: '#1a1a1a',
      highlight: '#b4441f',
      bg: '#fbfaf7',
      bgElevated: '#ffffff',
      fg: '#1a1a1a',
      fgMuted: '#5c5a55',
      fgSubtle: '#9b978f',
      selection: '#f0ede6',
      border: '#e7e3da',
      radius: '4px',
      radiusItem: '2px',
      shadow: '0 1px 0 rgba(0,0,0,.04), 0 18px 40px -16px rgba(60,40,10,.25)',
    },
  },
}

/** Convert a camelCase var name to `--qb-kebab-case`. */
export function cssVarName(key: string): string {
  return `--qb-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`
}

/** Resolve the CSS variables for a theme + appearance. */
export function resolveThemeVars(
  theme: ThemePresetName | { preset?: ThemePresetName; vars?: ThemeVars; light?: ThemeVars; dark?: ThemeVars } | undefined,
  appearance: 'light' | 'dark',
): { vars: ThemeVars; appearance: 'light' | 'dark' } {
  const cfg = typeof theme === 'string' ? { preset: theme } : (theme ?? {})
  const preset = cfg.preset ? presets[cfg.preset] : undefined
  const effective = preset?.only ?? (cfg.preset === 'light' ? 'light' : cfg.preset === 'dark' ? 'dark' : appearance)
  const vars: ThemeVars = {
    ...(effective === 'dark' ? preset?.dark : preset?.light),
    ...cfg.vars,
    ...(effective === 'dark' ? cfg.dark : cfg.light),
  }
  return { vars, appearance: effective }
}

/** Generate a CSS snippet for a theme, for copy/pasting into your stylesheet. */
export function themeToCss(vars: ThemeVars, selector = '.qb-root'): string {
  const body = Object.entries(vars)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `  ${cssVarName(k)}: ${v};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}
