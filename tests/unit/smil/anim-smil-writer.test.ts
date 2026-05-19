import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildSlideTiming,
  buildSlideTransition,
  mapTransitionToPptx,
  resetSmilNodeId,
  type SmilSlideTiming,
  type SmilElementAnim
} from '../../../src/main/utils/anim-smil-writer'

beforeEach(() => {
  resetSmilNodeId(1000)
})

function makeAnim(overrides: Partial<SmilElementAnim> = {}): SmilElementAnim {
  return {
    spid: 1,
    type: 'fade-up',
    duration: 500,
    delay: 0,
    order: 0,
    ...overrides
  }
}

describe('buildSlideTiming', () => {
  it('returns empty string for empty elements', () => {
    expect(buildSlideTiming({ elements: [] })).toBe('')
  })

  it('generates <p:timing> with correct structure for single element', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ spid: 5, type: 'fade', duration: 400 })]
    })
    expect(result).toContain('<p:timing>')
    expect(result).toContain('<p:tnLst>')
    expect(result).toContain('<p:seq')
    expect(result).toContain('presetID="10"')
    expect(result).toContain('presetClass="entr"')
    expect(result).toContain('<p:spTgt spid="5"/>')
    expect(result).toContain('dur="400"')
    expect(result).toContain('</p:timing>')
  })

  it('sorts elements by order', () => {
    const result = buildSlideTiming({
      elements: [
        makeAnim({ spid: 10, order: 2, type: 'fade' }),
        makeAnim({ spid: 20, order: 1, type: 'fade' })
      ]
    })
    const spid10Index = result.indexOf('spid="10"')
    const spid20Index = result.indexOf('spid="20"')
    expect(spid20Index).toBeLessThan(spid10Index)
  })

  it('emits presetSubtype for directional fade-up (fly from bottom)', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'fade-up' })]
    })
    expect(result).toContain('presetID="7"')
    expect(result).toContain('presetClass="entr"')
    expect(result).toContain('presetSubtype="8"')
    // fade-up also gets a companion filter element
    expect(result).toContain('filter="fade"')
  })

  it('emits presetSubtype for fade-down (fly from top)', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'fade-down' })]
    })
    expect(result).toContain('presetSubtype="1"')
    expect(result).toContain('filter="fade"')
  })

  it('emits presetSubtype for fade-left (fly from left)', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'fade-left' })]
    })
    expect(result).toContain('presetSubtype="2"')
    expect(result).toContain('filter="fade"')
  })

  it('emits presetSubtype for fade-right (fly from right)', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'fade-right' })]
    })
    expect(result).toContain('presetSubtype="3"')
    expect(result).toContain('filter="fade"')
  })

  it('scale-in uses presetID 31 (zoom) without filter', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'scale-in' })]
    })
    expect(result).toContain('presetID="31"')
    expect(result).not.toContain('filter="fade"')
  })

  it('slide-up uses presetID 7 subtype 8 without filter', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'slide-up' })]
    })
    expect(result).toContain('presetID="7"')
    expect(result).toContain('presetSubtype="8"')
    expect(result).not.toContain('filter="fade"')
  })

  it('slide-left uses presetID 7 subtype 2 without filter', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ type: 'slide-left' })]
    })
    expect(result).toContain('presetID="7"')
    expect(result).toContain('presetSubtype="2"')
    expect(result).not.toContain('filter="fade"')
  })

  it('preserves delay in stCondLst', () => {
    const result = buildSlideTiming({
      elements: [makeAnim({ delay: 250 })]
    })
    expect(result).toContain('delay="250"')
  })

  it('clamps duration to [100, 5000] range', () => {
    const tooFast = buildSlideTiming({
      elements: [makeAnim({ duration: 50 })]
    })
    expect(tooFast).toContain('dur="100"')

    const tooSlow = buildSlideTiming({
      elements: [makeAnim({ duration: 10000 })]
    })
    expect(tooSlow).toContain('dur="5000"')
  })

  it('generates unique node IDs per call', () => {
    const first = buildSlideTiming({
      elements: [makeAnim({ spid: 1 })]
    })
    const second = buildSlideTiming({
      elements: [makeAnim({ spid: 2 })]
    })
    expect(first).not.toBe(second)
    expect(first.match(/id="(\d+)"/g)).not.toEqual(second.match(/id="(\d+)"/g))
  })

  it('handles multiple elements in sequence', () => {
    const result = buildSlideTiming({
      elements: [
        makeAnim({ spid: 1, order: 0, type: 'fade' }),
        makeAnim({ spid: 2, order: 1, type: 'scale-in' }),
        makeAnim({ spid: 3, order: 2, type: 'slide-up' })
      ]
    })
    // All three spid values appear (filter companions may duplicate some spids)
    expect(result).toContain('spid="1"')
    expect(result).toContain('spid="2"')
    expect(result).toContain('spid="3"')
    // Order: spid=1 (order 0) before spid=2 (order 1) before spid=3 (order 2)
    const i1 = result.indexOf('spid="1"')
    const i2 = result.indexOf('spid="2"')
    const i3 = result.indexOf('spid="3"')
    expect(i1).toBeLessThan(i2)
    expect(i2).toBeLessThan(i3)
  })
})

describe('buildSlideTransition', () => {
  it('returns empty string for none', () => {
    expect(buildSlideTransition('none')).toBe('')
  })

  it('generates fade transition', () => {
    const result = buildSlideTransition('fade', 500)
    expect(result).toContain('<p:transition')
    expect(result).toContain('spd="fade"')
    expect(result).toContain('dur="500"')
    expect(result).toContain('advClick="1"')
  })

  it('generates push transition', () => {
    const result = buildSlideTransition('push', 300)
    expect(result).toContain('spd="push"')
  })

  it('generates wipe transition', () => {
    const result = buildSlideTransition('wipe', 400)
    expect(result).toContain('spd="wipe"')
  })

  it('generates cover transition', () => {
    const result = buildSlideTransition('cover')
    expect(result).toContain('spd="cover"')
  })

  it('generates uncover transition', () => {
    const result = buildSlideTransition('uncover')
    expect(result).toContain('spd="uncover"')
  })

  it('generates dissolve transition', () => {
    const result = buildSlideTransition('dissolve')
    expect(result).toContain('spd="dissolve"')
  })

  it('clamps duration to valid range', () => {
    const tooFast = buildSlideTransition('fade', 50)
    expect(tooFast).toContain('dur="100"')
    const tooSlow = buildSlideTransition('fade', 10000)
    expect(tooSlow).toContain('dur="5000"')
  })

  it('defaults duration to 400ms when omitted', () => {
    const result = buildSlideTransition('fade')
    expect(result).toContain('dur="400"')
  })
})

describe('mapTransitionToPptx', () => {
  it('returns none for none', () => {
    expect(mapTransitionToPptx('none')).toBe('none')
  })

  it('maps fade to fade', () => {
    expect(mapTransitionToPptx('fade')).toBe('fade')
  })

  it('maps slide-left to push', () => {
    expect(mapTransitionToPptx('slide-left')).toBe('push')
  })

  it('maps slide-up to push', () => {
    expect(mapTransitionToPptx('slide-up')).toBe('push')
  })

  it('maps push to push', () => {
    expect(mapTransitionToPptx('push')).toBe('push')
  })

  it('maps wipe to wipe', () => {
    expect(mapTransitionToPptx('wipe')).toBe('wipe')
  })

  it('maps zoom to dissolve', () => {
    expect(mapTransitionToPptx('zoom')).toBe('dissolve')
  })

  it('falls back to fade for unknown types', () => {
    expect(mapTransitionToPptx('unknown-type')).toBe('fade')
  })
})
