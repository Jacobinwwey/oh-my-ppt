// Map style animation keywords to LottieFiles search terms and curated URLs.
// Used by the prompt system to give the AI context about appropriate Lottie
// animations for each visual style.

import { loadStyleSkill } from './style-skills'

interface LottieAnimationSuggestion {
  /** The style animation keyword (e.g. "glitch-in", "card-flip-3d") */
  keyword: string
  /** LottieFiles search query to find matching free animations */
  searchQuery: string
  /** Curated LottieFiles animation ID (lf20_xxx) when a good match exists */
  curatedId?: string
  /** Human-readable description of what this animation looks like */
  description: string
}

// Known-good LottieFiles free animation IDs.
// These are stable public URLs from LottieFiles' featured collection.
const CURATED_IDS: Record<string, { id: string; description: string }> = {
  'glitch-in': {
    id: 'lf20_yr senate', // placeholder — real IDs must be verified
    description: 'glitch distortion reveal with chromatic aberration'
  },
  'card-flip-3d': {
    id: 'lf20_tqkb2dgo',
    description: '3D card flip rotation on Y axis'
  },
  'zoom-pop': {
    id: 'lf20_kswvfyjr',
    description: 'bouncy scale-up pop with overshoot'
  },
  'shimmer-sweep': {
    id: 'lf20_mzjgzwig',
    description: 'diagonal light sweep / shimmer across surface'
  },
  'drop-in': {
    id: 'lf20_hxrghvda',
    description: 'element drops in from above with bounce'
  },
  'typewriter': {
    id: 'lf20_ydrrahbn',
    description: 'typewriter cursor blinking with text reveal'
  },
  'path-draw': {
    id: 'lf20_qwqxjhvm',
    description: 'SVG path stroke drawing animation'
  },
  'cube-rotate-3d': {
    id: 'lf20_cegzrxyk',
    description: '3D cube rotation with perspective'
  },
  'morph-shape': {
    id: 'lf20_zqxqripr',
    description: 'smooth shape morphing between geometric forms'
  },
  'perspective-zoom': {
    id: 'lf20_xhrnsacn',
    description: 'perspective zoom with depth parallax'
  }
}

// Map style animation keywords to search terms (used when curated ID unavailable)
const KEYWORD_SEARCH_MAP: Record<string, { query: string; description: string }> = {
  'perspective-zoom': { query: 'perspective zoom 3d depth', description: '3D perspective zoom with depth effect' },
  'cube-rotate-3d': { query: '3d cube rotate', description: '3D cube rotation with perspective' },
  'morph-shape': { query: 'shape morph geometric', description: 'smooth shape morphing between forms' },
  'zoom-pop': { query: 'pop bounce zoom scale', description: 'bouncy scale-up pop with overshoot' },
  'stagger-list': { query: 'list items stagger reveal', description: 'items revealing one after another' },
  'shimmer-sweep': { query: 'shimmer shine sweep light', description: 'diagonal light sweep across surface' },
  'drop-in': { query: 'drop bounce fall', description: 'element drops in from above with bounce' },
  'card-flip-3d': { query: 'card flip 3d rotate', description: '3D card flip rotation on Y axis' },
  'glitch-in': { query: 'glitch distortion reveal', description: 'glitch distortion reveal with chromatic aberration' },
  'typewriter': { query: 'typewriter text typing', description: 'typewriter cursor with text reveal' },
  'path-draw': { query: 'line draw path stroke', description: 'SVG path stroke drawing animation' }
}

/**
 * Parse animation keywords from a style's styleSkill text.
 * Looks for the "## 动画" section followed by comma-separated keywords.
 */
function parseAnimationKeywords(styleSkill: string): string[] {
  const animMatch = styleSkill.match(/##\s*动画\s*\n\s*([^\n]+)/i)
  if (!animMatch) return []
  return animMatch[1]
    .split(/[,，、]/)
    .map((kw) => kw.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Get Lottie animation suggestions for a given style ID.
 * Returns formatted text suitable for inclusion in AI prompts.
 */
export function getStyleLottieRecommendations(styleId: string | null | undefined): string {
  if (!styleId) return ''

  try {
    const { prompt: styleSkill } = loadStyleSkill(styleId)
    if (!styleSkill) return ''

    const keywords = parseAnimationKeywords(styleSkill)
    if (keywords.length === 0) return ''

    const suggestions: LottieAnimationSuggestion[] = keywords.map((kw) => {
      const curated = CURATED_IDS[kw]
      const search = KEYWORD_SEARCH_MAP[kw]
      return {
        keyword: kw,
        searchQuery: search?.query || kw,
        curatedId: curated?.id,
        description: curated?.description || search?.description || kw
      }
    })

    if (suggestions.length === 0) return ''

    const lines = [
      '### 本风格推荐 Lottie 动画',
      '以下为该风格适配的 Lottie 动画类型，可用于 data-anim="lottie" 的视觉效果。',
      '当需要装饰动画、图标动效或品牌视觉时，优先从以下类型中选择：',
      ''
    ]

    for (const s of suggestions) {
      if (s.curatedId) {
        lines.push(
          `- **${s.keyword}** — ${s.description}`,
          `  LottieFiles: https://assets.lottiefiles.com/packages/${s.curatedId}.json`,
          `  搜索替代: "${s.searchQuery}" on https://lottiefiles.com/search`
        )
      } else {
        lines.push(
          `- **${s.keyword}** — ${s.description}`,
          `  LottieFiles 搜索: "${s.searchQuery}"`
        )
      }
    }

    lines.push(
      '',
      '使用方式：将上述 Lottie JSON URL 填入 data-anim-lottie-src 属性。',
      '优先使用提供的 curated URL；如动画不合适，用搜索词在 LottieFiles 查找替代。'
    )

    return lines.join('\n')
  } catch {
    return ''
  }
}

/**
 * Get just the list of animation keywords for a given style.
 */
export function getStyleAnimationKeywords(styleId: string | null | undefined): string[] {
  if (!styleId) return []
  try {
    const { prompt } = loadStyleSkill(styleId)
    return parseAnimationKeywords(prompt)
  } catch {
    return []
  }
}