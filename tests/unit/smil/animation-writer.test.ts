import { describe, it, expect } from 'vitest'
import {
  buildSlideTimingXml,
  buildSlideTransitionXml,
  type PptxTargetAnimation
} from '../../../src/main/utils/html-pptx/animation-writer'

function makeAnim(overrides: Partial<PptxTargetAnimation> = {}): PptxTargetAnimation {
  return {
    spid: 1,
    type: 'fade-up',
    trigger: 'load',
    from: 'bottom',
    duration: 500,
    delay: 0,
    order: 0,
    ...overrides
  }
}

describe('buildSlideTimingXml', () => {
  it('returns empty string for empty elements', () => {
    expect(buildSlideTimingXml([])).toBe('')
  })

  it('generates <p:timing> with correct structure for single element', () => {
    const result = buildSlideTimingXml([
      makeAnim({ spid: 5, type: 'fade', duration: 400 })
    ])
    expect(result).toContain('<p:timing>')
    expect(result).toContain('<p:tnLst>')
    expect(result).toContain('<p:par>')
    expect(result).toContain('<p:seq')
    expect(result).toContain('nodeType="tmRoot"')
    expect(result).toContain('nodeType="mainSeq"')
    expect(result).toContain('<p:spTgt spid="5"/>')
    expect(result).toContain('</p:timing>')
    expect(result).toContain('<p:prevCondLst>')
    expect(result).toContain('<p:nextCondLst>')
  })

  it('includes presetID on cTn elements', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade' })
    ])
    expect(result).toContain('presetID="10"')
    expect(result).toContain('presetClass="entr"')
  })

  it('includes presetSubtype for motion animations', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade-up' })
    ])
    expect(result).toContain('presetID="2"')
    expect(result).toContain('presetSubtype="8"')
  })

  it('sets nodeType="withEffect" for load trigger', () => {
    const result = buildSlideTimingXml([
      makeAnim({ trigger: 'load' })
    ])
    expect(result).toContain('nodeType="withEffect"')
  })

  it('sets nodeType="clickEffect" for click trigger', () => {
    const result = buildSlideTimingXml([
      makeAnim({ trigger: 'click' })
    ])
    expect(result).toContain('nodeType="clickEffect"')
  })

  it('includes <p:bldLst> with bldP entries', () => {
    const result = buildSlideTimingXml([
      makeAnim({ spid: 2 }),
      makeAnim({ spid: 3 })
    ])
    expect(result).toContain('<p:bldLst>')
    expect(result).toContain('<p:bldP spid="2" grpId="0"/>')
    expect(result).toContain('<p:bldP spid="3" grpId="0"/>')
    expect(result).toContain('</p:bldLst>')
  })

  it('deduplicates bldP entries by spid', () => {
    const result = buildSlideTimingXml([
      makeAnim({ spid: 2, order: 0 }),
      makeAnim({ spid: 2, order: 1, type: 'fade' })
    ])
    const bldPCount = (result.match(/<p:bldP spid="2"/g) || []).length
    expect(bldPCount).toBe(1)
  })

  it('sorts elements by order', () => {
    const result = buildSlideTimingXml([
      makeAnim({ spid: 10, order: 2, type: 'fade' }),
      makeAnim({ spid: 20, order: 1, type: 'fade' })
    ])
    const spid10Index = result.indexOf('spid="10"')
    const spid20Index = result.indexOf('spid="20"')
    expect(spid20Index).toBeLessThan(spid10Index)
  })

  it('fade emits p:animEffect filter="fade" and visibility set', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade' })
    ])
    expect(result).toContain('<p:animEffect transition="in" filter="fade">')
    expect(result).toContain('<p:attrName>style.visibility</p:attrName>')
    expect(result).toContain('<p:strVal val="visible"/>')
    expect(result).not.toContain('ppt_x')
    expect(result).not.toContain('ppt_y')
  })

  it('fade-up emits ppt_x/ppt_y animation (motion from bottom)', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade-up' })
    ])
    expect(result).toContain('<p:animEffect transition="in" filter="fade">')
    expect(result).toContain('<p:attrName>ppt_x</p:attrName>')
    expect(result).toContain('<p:attrName>ppt_y</p:attrName>')
    expect(result).toContain('#ppt_y+#ppt_h/2')
  })

  it('fade-down emits ppt_y with fromTop formula', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade-down' })
    ])
    expect(result).toContain('#ppt_y-#ppt_h/2')
  })

  it('fade-left emits ppt_x with fromRight formula', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade-left' })
    ])
    expect(result).toContain('#ppt_x+#ppt_w/2')
  })

  it('fade-right emits ppt_x with fromLeft formula', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'fade-right' })
    ])
    expect(result).toContain('#ppt_x-#ppt_w/2')
  })

  it('scale-in emits p:animScale', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'scale-in' })
    ])
    expect(result).toContain('<p:animScale>')
    expect(result).toContain('<p:from x="85000" y="85000"/>')
    expect(result).toContain('<p:to x="100000" y="100000"/>')
  })

  it('slide-up emits motion and fade without ppt_x change', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'slide-up' })
    ])
    expect(result).toContain('<p:animEffect transition="in" filter="fade">')
    expect(result).toContain('#ppt_y+#ppt_h/2')
  })

  it('slide-left emits motion and fade', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'slide-left' })
    ])
    expect(result).toContain('#ppt_x+#ppt_w/2')
  })

  it('preserves delay in stCondLst', () => {
    const result = buildSlideTimingXml([
      makeAnim({ delay: 250 })
    ])
    expect(result).toContain('delay="250"')
  })

  it('clamps duration to [100, 5000] range', () => {
    const tooFast = buildSlideTimingXml([
      makeAnim({ duration: 50 })
    ])
    expect(tooFast).toContain('dur="100"')

    const tooSlow = buildSlideTimingXml([
      makeAnim({ duration: 10000 })
    ])
    expect(tooSlow).toContain('dur="5000"')
  })

  it('generates unique node IDs per call with different startNodeId', () => {
    const first = buildSlideTimingXml([makeAnim({ spid: 1 })], 1000)
    const second = buildSlideTimingXml([makeAnim({ spid: 1 })], 2000)
    expect(first).not.toBe(second)
    expect(first.match(/id="(\d+)"/g)).not.toEqual(second.match(/id="(\d+)"/g))
  })

  it('handles multiple elements in sequence', () => {
    const result = buildSlideTimingXml([
      makeAnim({ spid: 1, order: 0, type: 'fade' }),
      makeAnim({ spid: 2, order: 1, type: 'scale-in' }),
      makeAnim({ spid: 3, order: 2, type: 'slide-up' })
    ])
    expect(result).toContain('spid="1"')
    expect(result).toContain('spid="2"')
    expect(result).toContain('spid="3"')
    const i1 = result.indexOf('spid="1"')
    const i2 = result.indexOf('spid="2"')
    const i3 = result.indexOf('spid="3"')
    expect(i1).toBeLessThan(i2)
    expect(i2).toBeLessThan(i3)
  })

  it('includes kickoff par with delay="indefinite" and onBegin condition', () => {
    const result = buildSlideTimingXml([makeAnim({ type: 'fade' })])
    expect(result).toContain('delay="indefinite"')
    expect(result).toContain('evt="onBegin"')
  })

  it('wipe type uses wipe filter effect', () => {
    const result = buildSlideTimingXml([
      makeAnim({ type: 'wipe', from: 'left' })
    ])
    expect(result).toContain('presetID="5"')
    expect(result).toContain('filter="wipe(r)"')
  })
})

describe('buildSlideTransitionXml', () => {
  it('returns empty string for none', () => {
    expect(buildSlideTransitionXml('none')).toBe('')
  })

  it('generates fade transition with <p:fade/> child', () => {
    const result = buildSlideTransitionXml('fade', 500)
    expect(result).toContain('<p:transition')
    expect(result).toContain('<p:fade/>')
    expect(result).toContain('advClick="1"')
    expect(result).toContain('</p:transition>')
  })

  it('uses spd="fast" for duration <= 300ms', () => {
    const result = buildSlideTransitionXml('fade', 200)
    expect(result).toContain('spd="fast"')
  })

  it('uses spd="med" for duration 301-700ms', () => {
    const result = buildSlideTransitionXml('fade', 500)
    expect(result).toContain('spd="med"')
  })

  it('uses spd="slow" for duration > 700ms', () => {
    const result = buildSlideTransitionXml('fade', 1000)
    expect(result).toContain('spd="slow"')
  })

  it('includes dur attribute on transition element', () => {
    const result = buildSlideTransitionXml('fade', 500)
    expect(result).toContain('dur="500"')
  })

  it('generates push transition', () => {
    const result = buildSlideTransitionXml('push')
    expect(result).toContain('<p:push/>')
  })

  it('generates wipe transition', () => {
    const result = buildSlideTransitionXml('wipe')
    expect(result).toContain('<p:wipe/>')
  })

  it('generates cover transition', () => {
    const result = buildSlideTransitionXml('cover')
    expect(result).toContain('<p:cover/>')
  })

  it('generates uncover transition', () => {
    const result = buildSlideTransitionXml('uncover')
    expect(result).toContain('<p:uncover/>')
  })

  it('generates dissolve transition', () => {
    const result = buildSlideTransitionXml('dissolve')
    expect(result).toContain('<p:dissolve/>')
  })

  it('maps slide-left to push transition', () => {
    const result = buildSlideTransitionXml('slide-left')
    expect(result).toContain('<p:push/>')
  })

  it('maps zoom to dissolve transition', () => {
    const result = buildSlideTransitionXml('zoom')
    expect(result).toContain('<p:dissolve/>')
  })

  it('falls back to fade for unknown types', () => {
    const result = buildSlideTransitionXml('unknown-type')
    expect(result).toContain('<p:fade/>')
  })
})
