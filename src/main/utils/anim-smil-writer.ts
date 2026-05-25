/**
 * Maps declarative data-anim animation configs to PPTX SMIL XML
 * for native PowerPoint animation round-trip.
 *
 * PPTX SMIL reference:
 *   presetID / presetClass / presetSubtype on <p:animEffect>
 *
 *   fade      (10)  → entrance fade
 *   fade-up   (7/8) → entrance fly from bottom + fade filter
 *   fade-down (7/1) → entrance fly from top + fade filter
 *   fade-left (7/2) → entrance fly from left + fade filter
 *   fade-right(7/3) → entrance fly from right + fade filter
 *   scale-in  (31)  → entrance zoom
 *   slide-up  (7/8) → entrance fly from bottom
 *   slide-left(7/2) → entrance fly from left
 *
 * Complex timelines, spring easing, and custom PPT.animate() scripts
 * are NOT mapped — they fall back to static screenshot export.
 */

export type SmilAnimType =
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale-in'
  | 'slide-up'
  | 'slide-left'

export interface SmilElementAnim {
  spid: number // shape ID in the slide XML
  type: SmilAnimType
  duration: number // ms
  delay: number // ms
  order: number // sequence index within slide
}

export interface SmilSlideTiming {
  elements: SmilElementAnim[]
}

// PPTX presetID values: 10=fade, 7=fly, 31=zoom
// presetSubtype for fly (7): 1=top, 2=left, 3=right, 8=bottom
const SMIL_PRESET: Record<
  SmilAnimType,
  { presetID: number; presetClass: string; presetSubtype?: number; filter?: string }
> = {
  fade:       { presetID: 10, presetClass: 'entr' },
  'fade-up':  { presetID: 7,  presetClass: 'entr', presetSubtype: 8, filter: 'fade' },
  'fade-down':{ presetID: 7,  presetClass: 'entr', presetSubtype: 1, filter: 'fade' },
  'fade-left':{ presetID: 7,  presetClass: 'entr', presetSubtype: 2, filter: 'fade' },
  'fade-right':{ presetID: 7,  presetClass: 'entr', presetSubtype: 3, filter: 'fade' },
  'scale-in': { presetID: 31, presetClass: 'entr' },
  'slide-up': { presetID: 7,  presetClass: 'entr', presetSubtype: 8 },
  'slide-left':{ presetID: 7,  presetClass: 'entr', presetSubtype: 2 }
}

function buildAnimEffectAttrs(anim: SmilElementAnim): string {
  const preset = SMIL_PRESET[anim.type]
  if (!preset) return ''

  let attrs = `presetID="${preset.presetID}" presetClass="${preset.presetClass}"`
  if (preset.presetSubtype !== undefined) {
    attrs += ` presetSubtype="${preset.presetSubtype}"`
  }
  attrs += ' transition="in"'
  return attrs
}

/**
 * Build a <p:timing> block for a slide from a list of element animations.
 * Each element gets its own <p:animEffect> inside a <p:seq> container.
 *
 * For types with both motion (fly) and fade, two sibling animEffect
 * elements are generated inside a <p:childTnLst> — one for the motion
 * path, one for the fade filter.
 */
export function buildSlideTiming(timing: SmilSlideTiming, startNodeId = 1000): string {
  if (!timing.elements || timing.elements.length === 0) return ''

  let nodeId = startNodeId
  const nextId = (): number => {
    nodeId += 1
    return nodeId
  }

  const seqNodeId = nextId()
  const children = [...timing.elements]
    .sort((a, b) => a.order - b.order)
    .map((anim) => {
      const preset = SMIL_PRESET[anim.type]
      if (!preset) return ''

      const animNodeId = nextId()
      const durMs = Math.max(100, Math.min(5000, anim.duration))
      const delayMs = Math.max(0, anim.delay)

      // Base effect: preset-driven entrance (fade, fly, zoom)
      const baseAttrs = buildAnimEffectAttrs(anim)

      // Optional filter: layered fade on top of fly motion
      const filterChunk = preset.filter
        ? `\n                  <p:animEffect transition="in" filter="${preset.filter}">` +
          `\n                    <p:cTn id="${nextId()}" dur="${durMs}">` +
          '\n                      <p:stCondLst>' +
          `\n                        <p:cond delay="${delayMs}"/>` +
          '\n                      </p:stCondLst>' +
          '\n                    </p:cTn>' +
          `\n                    <p:target>` +
          `\n                      <p:spTgt spid="${anim.spid}"/>` +
          '\n                    </p:target>' +
          '\n                  </p:animEffect>'
        : ''

      return `\n                <p:animEffect ${baseAttrs}>
                  <p:cTn id="${animNodeId}" dur="${durMs}">
                    <p:stCondLst>
                      <p:cond delay="${delayMs}"/>
                    </p:stCondLst>
                  </p:cTn>
                  <p:target>
                    <p:spTgt spid="${anim.spid}"/>
                  </p:target>
                </p:animEffect>${filterChunk}`
    })
    .filter(Boolean)
    .join('\n')

  if (!children) return ''

  return `<p:timing>
    <p:tnLst>
      <p:seq concurrent="0" nextAc="seek">
        <p:cTn id="${seqNodeId}" dur="indefinite">
          <p:childTnLst>
${children}
          </p:childTnLst>
        </p:cTn>
      </p:seq>
    </p:tnLst>
  </p:timing>`
}

/**
 * Build a <p:transition> element for slide-level transitions.
 * PPTX spec: child element defines type (e.g. <p:fade/>),
 * spd is speed (slow/med/fast), advClick controls advance-on-click.
 */
export function buildSlideTransition(
  type: 'fade' | 'push' | 'wipe' | 'cover' | 'uncover' | 'dissolve' | 'none',
  durationMs?: number
): string {
  if (type === 'none') return ''

  const childMap: Record<string, string> = {
    fade: 'fade',
    push: 'push',
    wipe: 'wipe',
    cover: 'cover',
    uncover: 'uncover',
    dissolve: 'dissolve'
  }

  const dur = Math.max(100, Math.min(5000, durationMs ?? 400))
  const spd = dur <= 300 ? 'fast' : dur <= 700 ? 'med' : 'slow'
  const child = childMap[type] || 'fade'

  return `<p:transition spd="${spd}" dur="${dur}" advClick="1"><p:${child}/></p:transition>`
}

/**
 * Map our internal transition types to PPTX native transition names.
 */
export function mapTransitionToPptx(
  type: string
): 'fade' | 'push' | 'wipe' | 'cover' | 'uncover' | 'dissolve' | 'none' {
  const mapping: Record<string, 'fade' | 'push' | 'wipe' | 'cover' | 'uncover' | 'dissolve'> = {
    fade: 'fade',
    'slide-left': 'push',
    'slide-up': 'push',
    push: 'push',
    wipe: 'wipe',
    cover: 'cover',
    uncover: 'uncover',
    dissolve: 'dissolve',
    zoom: 'dissolve'
  }
  if (type === 'none') return 'none'
  return mapping[type] || 'fade'
}
