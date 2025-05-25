/**
 * Maps declarative data-anim animation configs to PPTX SMIL XML
 * for native PowerPoint animation round-trip.
 *
 * PowerPoint SMIL structure (simplified):
 *   <p:timing>
 *     <p:tnLst>
 *       <p:par>                          <!-- root par -->
 *         <p:cTn id dur="indefinite" nodeType="tmRoot">
 *           <p:childTnLst>
 *             <p:seq concurrent="1" nextAc="seek">
 *               <p:cTn id dur="indefinite" nodeType="mainSeq">
 *                 <p:childTnLst>
 *                   <p:par>              <!-- click group (afterPrevious) -->
 *                     <p:cTn id fill="hold">
 *                       <p:stCondLst><p:cond delay="0"/></p:stCondLst>
 *                       <p:childTnLst>
 *                         <p:par>        <!-- per-shape par -->
 *                           ...
 *                         </p:par>
 *                       </p:childTnLst>
 *                     </p:cTn>
 *                   </p:par>
 *                 </p:childTnLst>
 *               </p:cTn>
 *               <p:prevCondLst>...</p:prevCondLst>
 *               <p:nextCondLst>...</p:nextCondLst>
 *             </p:seq>
 *           </p:childTnLst>
 *         </p:cTn>
 *       </p:par>
 *     </p:tnLst>
 *   </p:timing>
 *
 * Animation types supported:
 *   fade (10)      → entrance fade
 *   fade-up (7/8)  → entrance fly from bottom
 *   fade-down (7/1)→ entrance fly from top
 *   fade-left (7/2)→ entrance fly from left
 *   fade-right(7/3)→ entrance fly from right
 *   scale-in (31)  → entrance zoom
 *   slide-up (7/8) → entrance fly from bottom
 *   slide-left(7/2)→ entrance fly from left
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
  spid: number
  type: SmilAnimType
  duration: number
  delay: number
  order: number
}

export interface SmilSlideTiming {
  elements: SmilElementAnim[]
}

const SMIL_PRESET: Record<
  SmilAnimType,
  { presetID: number; presetClass: string; presetSubtype?: number; filter?: string }
> = {
  fade:        { presetID: 10, presetClass: 'entr' },
  'fade-up':   { presetID: 7,  presetClass: 'entr', presetSubtype: 8, filter: 'fade' },
  'fade-down': { presetID: 7,  presetClass: 'entr', presetSubtype: 1, filter: 'fade' },
  'fade-left': { presetID: 7,  presetClass: 'entr', presetSubtype: 2, filter: 'fade' },
  'fade-right':{ presetID: 7,  presetClass: 'entr', presetSubtype: 3, filter: 'fade' },
  'scale-in':  { presetID: 31, presetClass: 'entr' },
  'slide-up':  { presetID: 7,  presetClass: 'entr', presetSubtype: 8 },
  'slide-left':{ presetID: 7,  presetClass: 'entr', presetSubtype: 2 }
}

export function buildSlideTiming(timing: SmilSlideTiming, startNodeId = 1000): string {
  if (!timing.elements || timing.elements.length === 0) return ''

  let nodeId = startNodeId
  const nextId = (): number => {
    nodeId += 1
    return nodeId
  }

  const rootParId = nextId()
  const seqId = nextId()
  const mainSeqId = nextId()
  const clickGroupId = nextId()

  const children = [...timing.elements]
    .sort((a, b) => a.order - b.order)
    .map((anim) => {
      const preset = SMIL_PRESET[anim.type]
      if (!preset) return ''

      const durMs = Math.max(100, Math.min(5000, anim.duration))
      const delayMs = Math.max(0, anim.delay)

      const shapeParId = nextId()
      const effectId = nextId()

      let attrs = `presetID="${preset.presetID}" presetClass="${preset.presetClass}"`
      if (preset.presetSubtype !== undefined) {
        attrs += ` presetSubtype="${preset.presetSubtype}"`
      }

      const filterXml = preset.filter
        ? `\n                    <p:animEffect transition="in" filter="${preset.filter}">
                      <p:cTn id="${nextId()}" dur="${durMs}"/>
                      <p:target><p:spTgt spid="${anim.spid}"/></p:target>
                    </p:animEffect>`
        : ''

      const nodeType = `nodeType="${preset.filter ? 'withEffect' : 'afterEffect'}"`

      return `<p:par>
                  <p:cTn id="${shapeParId}" fill="hold">
                    <p:stCondLst><p:cond delay="${delayMs}"/></p:stCondLst>
                    <p:childTnLst>
                      <p:animEffect ${attrs} transition="in" ${nodeType}>
                        <p:cTn id="${effectId}" dur="${durMs}" fill="hold"/>
                        <p:target><p:spTgt spid="${anim.spid}"/></p:target>
                      </p:animEffect>${filterXml}
                    </p:childTnLst>
                  </p:cTn>
                </p:par>`
    })
    .filter(Boolean)
    .join('\n')

  if (!children) return ''

  return `<p:timing>
    <p:tnLst>
      <p:par>
        <p:cTn id="${rootParId}" dur="indefinite" restart="never" nodeType="tmRoot">
          <p:childTnLst>
            <p:seq concurrent="1" nextAc="seek">
              <p:cTn id="${mainSeqId}" dur="indefinite" nodeType="mainSeq">
                <p:childTnLst>
                  <p:par>
                    <p:cTn id="${clickGroupId}" fill="hold">
                      <p:stCondLst><p:cond delay="0"/></p:stCondLst>
                      <p:childTnLst>
${children}
                      </p:childTnLst>
                    </p:cTn>
                  </p:par>
                </p:childTnLst>
              </p:cTn>
              <p:prevCondLst>
                <p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>
              </p:prevCondLst>
              <p:nextCondLst>
                <p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond>
              </p:nextCondLst>
            </p:seq>
          </p:childTnLst>
        </p:cTn>
      </p:par>
    </p:tnLst>
  </p:timing>`
}

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

  return `<p:transition spd="${spd}" advClick="1"><p:${child}/></p:transition>`
}

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
