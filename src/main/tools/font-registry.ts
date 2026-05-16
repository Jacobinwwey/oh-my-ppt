/**
 * Font registry: Google Fonts CDN URL mapping + user-uploaded fonts infrastructure.
 * Used by buildScaffoldDocument to auto-inject font loading + CSS variables.
 */

export interface FontFileEntry {
  file: string
  weight: number
}

export interface FontRegistryEntry {
  family: string
  files: FontFileEntry[]
  category: string
}

const CJK_FALLBACK = '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'

// ── Google Fonts CDN mapping ──

export interface GoogleFontEntry {
  family: string
  /** Google Fonts CSS API URL with weights and display=swap */
  url: string
  /** Category for AI selection guidance */
  category: string
}

/**
 * Built-in Google Fonts catalog.
 * Key = font family name (must match what AI writes in design contract `fonts` field).
 * Value = pre-built Google Fonts CDN URL.
 */
const GOOGLE_FONTS: Record<string, GoogleFontEntry> = {
  // Sans-serif body
  Poppins: { family: 'Poppins', url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap', category: '无衬线正文' },
  Inter: { family: 'Inter', url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap', category: '现代UI' },
  Lato: { family: 'Lato', url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap', category: '商务正文' },
  // Sans-serif title
  Montserrat: { family: 'Montserrat', url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap', category: '几何标题' },
  'Space Grotesk': { family: 'Space Grotesk', url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap', category: '科技感' },
  Quicksand: { family: 'Quicksand', url: 'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;700&display=swap', category: '圆润友好' },
  Raleway: { family: 'Raleway', url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;700&display=swap', category: '纤细优雅' },
  Oswald: { family: 'Oswald', url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap', category: '窄体冲击' },
  // Display
  'Bebas Neue': { family: 'Bebas Neue', url: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', category: '全大写展示' },
  Righteous: { family: 'Righteous', url: 'https://fonts.googleapis.com/css2?family=Righteous&display=swap', category: '复古粗体' },
  // Serif
  'Playfair Display': { family: 'Playfair Display', url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap', category: '优雅衬线' },
  Merriweather: { family: 'Merriweather', url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap', category: '经典衬线' },
  Lora: { family: 'Lora', url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap', category: '现代衬线' },
  // Handwritten
  Caveat: { family: 'Caveat', url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap', category: '手写标注' },
  Kalam: { family: 'Kalam', url: 'https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap', category: '手绘' },
  'Patrick Hand': { family: 'Patrick Hand', url: 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap', category: '清晰手写' },
  'Dancing Script': { family: 'Dancing Script', url: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap', category: '连笔花体' },
  Pacifico: { family: 'Pacifico', url: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap', category: '复古海报' },
  // Monospace
  'Fira Code': { family: 'Fira Code', url: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap', category: '等宽代码' },
  // Chinese fonts (Google Fonts CDN, auto-subsetted)
  'Noto Sans SC': { family: 'Noto Sans SC', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap', category: '中文无衬线' },
  'Noto Serif SC': { family: 'Noto Serif SC', url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap', category: '中文衬线' },
  'ZCOOL XiaoWei': { family: 'ZCOOL XiaoWei', url: 'https://fonts.googleapis.com/css2?family=ZCOOL+XiaoWei&display=swap', category: '中文艺术' },
  'ZCOOL QingKe HuangYou': { family: 'ZCOOL QingKe HuangYou', url: 'https://fonts.googleapis.com/css2?family=ZCOOL+QingKe+HuangYou&display=swap', category: '中文手写' },
  'Ma Shan Zheng': { family: 'Ma Shan Zheng', url: 'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&display=swap', category: '中文书法' },
  'Liu Jian Mao Cao': { family: 'Liu Jian Mao Cao', url: 'https://fonts.googleapis.com/css2?family=Liu+Jian+Mao+Cao&display=swap', category: '中文草书' },
}

export const AVAILABLE_GOOGLE_FONTS = GOOGLE_FONTS

/** Check if a font family name exists in the Google Fonts catalog. */
export function isGoogleFont(family: string): boolean {
  return family in GOOGLE_FONTS
}

/**
 * Build <link> tags for Google Fonts CDN from design contract font names.
 * Also injects CSS variables (--ppt-title-font, --ppt-body-font).
 */
export function buildGoogleFontLinks(fontFamilies: string[]): string {
  const entries = fontFamilies
    .map((f) => GOOGLE_FONTS[f])
    .filter((e): e is GoogleFontEntry => Boolean(e))

  if (entries.length === 0) return ''

  const links = entries.map((e) => `<link rel="stylesheet" href="${e.url}" />`)

  const titleFont = entries[0].family
  const bodyFont = entries.length > 1 ? entries[1].family : titleFont
  const cssVars = `<style data-ppt-fonts="1">:root{--ppt-title-font:"${titleFont}",${CJK_FALLBACK};--ppt-body-font:"${bodyFont}",${CJK_FALLBACK}}</style>`

  return `${links.join('\n    ')}\n    ${cssVars}`
}

// ── User-uploaded fonts (future) ──

let userFontRegistry: FontRegistryEntry[] = []

export function setUserFontRegistry(entries: FontRegistryEntry[]): void {
  userFontRegistry = entries
}

export function getUserFontRegistry(): FontRegistryEntry[] {
  return userFontRegistry
}

/**
 * Build a <style data-ppt-fonts="1"> tag with @font-face declarations
 * and CSS variables for title/body fonts from user-uploaded fonts.
 */
export function buildUserFontStyleTag(fontFamilies: string[]): string {
  const entries = fontFamilies
    .map((f) => userFontRegistry.find((e) => e.family === f))
    .filter((e): e is FontRegistryEntry => Boolean(e))

  if (entries.length === 0) return ''

  const fontFaces: string[] = []
  for (const entry of entries) {
    for (const f of entry.files) {
      fontFaces.push(
        `@font-face{font-family:"${entry.family}";src:url("./assets/fonts/user/${f.file}")format("woff2");font-weight:${f.weight};font-display:swap}`
      )
    }
  }

  const titleFont = entries[0].family
  const bodyFont = entries.length > 1 ? entries[1].family : titleFont
  const cssVars = `:root{--ppt-title-font:"${titleFont}",${CJK_FALLBACK};--ppt-body-font:"${bodyFont}",${CJK_FALLBACK}}`

  return `<style data-ppt-fonts="1">${fontFaces.join('')}${cssVars}</style>`
}

/**
 * JSON map of available Google Fonts for design contract prompt.
 * Key = font family name, value = category.
 */
export const FONT_MAP_FOR_PROMPT: Record<string, string> = {}
for (const [, entry] of Object.entries(GOOGLE_FONTS)) {
  FONT_MAP_FOR_PROMPT[entry.family] = entry.category
}
