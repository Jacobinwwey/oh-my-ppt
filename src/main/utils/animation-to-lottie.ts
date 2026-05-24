// Convert oh-my-ppt data-anim presets to Lottie JSON (Bodymovin schema v5.5+).
// Also handles raw Lottie JSON passthrough for data-anim="lottie" elements.

const SLIDE_WIDTH = 1600
const SLIDE_HEIGHT = 900

interface AnimTraceElement {
  type: 'data-anim' | 'lottie'
  animType?: string
  lottieSrc?: string
  lottieLoop?: boolean
  lottieAutoplay?: boolean
  lottieSpeed?: number
  trigger?: string
  duration?: number
  delay?: string
  easing?: string
  blockId?: string
  tagName?: string
  className?: string
}

interface AnimTrace {
  version: string
  elements: AnimTraceElement[]
}

interface LottieKeyframe {
  t: number
  s: number[]
  i?: { x: number; y: number }
  o?: { x: number; y: number }
}

type LottieKeyframeValue = number | number[] | LottieKeyframe[]

interface LottieLayer {
  ty: number       // layer type: 4=shape, 5=text
  nm: string
  ip: number       // in point (frames)
  op: number       // out point (frames)
  st: number       // start time (frames)
  ks: {
    o?: { a: number; k: LottieKeyframeValue }
    p?: { a: number; k: LottieKeyframeValue }
    s?: { a: number; k: LottieKeyframeValue }
    r?: { a: number; k: LottieKeyframeValue }
  }
  shapes?: Array<Record<string, unknown>>
}

// data-anim preset → Lottie keyframe data (at 60fps)
// For entrance animations: [startValue, endValue]
// For emphasis animations: [startValue, peakValue, endValue] (oscillating)
const PRESET_MAP: Record<string, { opacity: [number, number]; translate?: [number, number, number]; scale?: [number, number] }> = {
  'fade':       { opacity: [0, 1] },
  'fade-up':    { opacity: [0, 1], translate: [0, 20, 0] },
  'fade-down':  { opacity: [0, 1], translate: [0, -20, 0] },
  'fade-left':  { opacity: [0, 1], translate: [20, 0, 0] },
  'fade-right': { opacity: [0, 1], translate: [-20, 0, 0] },
  'scale-in':   { opacity: [0, 1], scale: [85, 100] },
  'slide-up':   { opacity: [0, 1], translate: [0, 40, 0] },
  'slide-left': { opacity: [0, 1], translate: [40, 0, 0] },
  // Emphasis presets — oscillating animations
  'pulse':      { opacity: [1, 1], scale: [100, 105] },
  'shake':      { opacity: [1, 1], translate: [6, 0, 0] },
  'bounce':     { opacity: [1, 1], translate: [0, 10, 0] },
  'glow':       { opacity: [1, 0.7] },
}

function parseStaggerDelay(raw: string): { gap: number; isStagger: boolean } {
  const match = raw.match(/stagger\s*\(\s*(\d+)\s*\)/)
  if (match) return { gap: Number(match[1]) || 50, isStagger: true }
  return { gap: Number(raw) || 0, isStagger: false }
}

function easingToLottieTangent(easing: string): { x: number; y: number } {
  switch (easing) {
    case 'easeOutBack': return { x: 0.34, y: 1.56 }
    case 'easeInOut':   return { x: 0.42, y: 0 }
    case 'linear':      return { x: 0, y: 0 }
    default:            return { x: 0.25, y: 0.1 } // easeOutCubic
  }
}

function buildLottieLayer(
  element: AnimTraceElement,
  index: number,
  staggerOffset: number
): LottieLayer | null {
  const preset = PRESET_MAP[element.animType || '']
  if (!preset) return null

  const fps = 60
  const durationMs = element.duration || 500
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps))
  const inPoint = Math.round((staggerOffset / 1000) * fps)
  const outPoint = inPoint + totalFrames

  const layer: LottieLayer = {
    ty: 4, // shape layer (generic container for transforms)
    nm: element.blockId || `anim-${index}`,
    ip: inPoint,
    op: outPoint,
    st: 0,
    ks: {}
  }

  // Opacity keyframe
  if (preset.opacity[0] !== preset.opacity[1]) {
    layer.ks.o = {
      a: 1,
      k: [
        { t: inPoint, s: [preset.opacity[0] * 100], i: easingToLottieTangent(element.easing || 'easeOutCubic'), o: { x: 0, y: 0 } },
        { t: outPoint, s: [preset.opacity[1] * 100] }
      ]
    }
  }

  // Scale keyframe
  if (preset.scale && preset.scale[0] !== preset.scale[1]) {
    layer.ks.s = {
      a: 1,
      k: [
        { t: inPoint, s: [preset.scale[0], preset.scale[0], 100], i: easingToLottieTangent(element.easing || 'easeOutCubic'), o: { x: 0, y: 0 } },
        { t: outPoint, s: [preset.scale[1], preset.scale[1], 100] }
      ]
    }
  }

  // Position keyframe (translate offset)
  if (preset.translate && (preset.translate[0] !== 0 || preset.translate[1] !== 0)) {
    // Note: position is relative to centered anchor, so [0,0] = center of layer
    // We use an offset that starts at translate[X,Y] and moves to [0,0]
    const startX = SLIDE_WIDTH / 2 + (preset.translate[2] !== undefined ? preset.translate[2] : 0)
    const startY = SLIDE_HEIGHT / 2
    // The Lottie position keyframe: start with offset, end at center
    layer.ks.p = {
      a: 1,
      k: [
        { t: inPoint, s: [startX + (preset.translate[0] || 0), startY + (preset.translate[1] || 0), 0], i: easingToLottieTangent(element.easing || 'easeOutCubic'), o: { x: 0, y: 0 } },
        { t: outPoint, s: [startX, startY, 0] }
      ]
    }
  }

  return layer
}

export interface LottieAnimationBundle {
  /** Lottie JSON string for embedding directly */
  json: string
  /** Number of layers/animated elements */
  elementCount: number
  /** Total duration in milliseconds */
  totalDurationMs: number
}

/**
 * Convert a page's animation trace to an embeddable Lottie JSON animation.
 * Handles data-anim presets by converting to Lottie keyframes.
 * For lottie-type elements, the src URL/JSON is returned as-is for passthrough.
 */
export function traceToLottieAnimation(trace: AnimTrace): LottieAnimationBundle | null {
  if (!trace?.elements?.length) return null

  const dataAnimElements = trace.elements.filter(
    (e) => e.type === 'data-anim' && PRESET_MAP[e.animType || '']
  )

  if (dataAnimElements.length === 0) return null

  const fps = 60
  const layers: LottieLayer[] = []
  let maxEndFrame = 0

  // Calculate stagger offsets
  const staggerGroups = new Map<string, number>()
  dataAnimElements.forEach((el) => {
    const { gap, isStagger } = parseStaggerDelay(el.delay || '0')
    let offset = 0
    if (isStagger) {
      const key = el.trigger || 'load'
      const count = staggerGroups.get(key) || 0
      offset = count * gap
      staggerGroups.set(key, count + 1)
    } else {
      offset = gap
    }

    const layer = buildLottieLayer(el, layers.length, offset)
    if (layer) {
      layers.push(layer)
      maxEndFrame = Math.max(maxEndFrame, layer.op)
    }
  })

  if (layers.length === 0) return null

  // Lottie document (Bodymovin schema)
  const lottieDoc = {
    v: '5.9.0',
    fr: fps,
    ip: 0,
    op: maxEndFrame + 10, // small tail
    w: SLIDE_WIDTH,
    h: SLIDE_HEIGHT,
    nm: 'oh-my-ppt slide animation',
    ddd: 0,
    assets: [] as Array<Record<string, unknown>>,
    layers: layers.reverse(), // Lottie renders bottom-up, so reverse
    markers: [] as Array<Record<string, unknown>>
  }

  return {
    json: JSON.stringify(lottieDoc),
    elementCount: layers.length,
    totalDurationMs: Math.round((maxEndFrame / fps) * 1000)
  }
}

/**
 * Wrap a raw Lottie JSON string as a bundle (for data-anim="lottie" passthrough).
 */
export function wrapRawLottieJson(jsonStr: string): LottieAnimationBundle | null {
  try {
    const parsed = JSON.parse(jsonStr)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      json: jsonStr,
      elementCount: (parsed.layers || []).length || 1,
      totalDurationMs: parsed.fr && parsed.op
        ? Math.round((parsed.op / parsed.fr) * 1000)
        : 2000
    }
  } catch {
    return null
  }
}