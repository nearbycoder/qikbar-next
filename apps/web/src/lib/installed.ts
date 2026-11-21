export const INSTALLED_KEY = 'qikbar-site:installed'

export function installedNames(): string[] {
  try {
    return JSON.parse(localStorage.getItem(INSTALLED_KEY) ?? '[]')
  } catch {
    return []
  }
}
