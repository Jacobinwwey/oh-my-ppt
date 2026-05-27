import { describe, it, expect } from 'vitest'
import { buildSlideXml } from '../../../src/main/utils/html-pptx/ooxml-writer'
import type { HtmlToPptxSlide, HtmlToPptxAnimationTrace } from '../../../src/main/utils/html-pptx/types'

describe('PPTX integration: timing XML in slide output', () => {
  const makeSlideWithAnimations = (
    traces: HtmlToPptxAnimationTrace[]
  ): HtmlToPptxSlide => ({
    texts: [
      { text: 'Animated Title', x: 1, y: 0.5, w: 11, h: 1.2, fontSize: 36 },
      { text: 'Body text', x: 1, y: 3, w: 11, h: 2, fontSize: 18 }
    ],
    shapes: [],
    images: [],
    tables: [],
    animationTraces: traces
  })

  it('injects <p:timing> when animation traces are present and match shapes', () => {
    const slide = makeSlideWithAnimations([
      { type: 'fade-up', duration: 500, delay: 0, x: 60, y: 30, w: 1000, h: 70 },
      { type: 'fade', duration: 400, delay: 200, x: 60, y: 180, w: 1000, h: 120 }
    ])
    const imageRels = new Map<string, { rId: string; mediaFile: string }>()
    const xml = buildSlideXml(slide, imageRels, 1)

    expect(xml).toContain('<p:timing>')
    expect(xml).toContain('</p:timing>')
    expect(xml).toContain('presetID="7"')
    expect(xml).toContain('presetSubtype="8"')
    expect(xml).toContain('presetID="10"')
    expect(xml).toContain('spid="')
  })

  it('omits <p:timing> when no animation traces are present', () => {
    const slide: HtmlToPptxSlide = {
      texts: [{ text: 'Hello', x: 1, y: 1, w: 5, h: 1, fontSize: 24 }],
      shapes: [],
      images: [],
      tables: []
    }
    const imageRels = new Map<string, { rId: string; mediaFile: string }>()
    const xml = buildSlideXml(slide, imageRels, 1)

    expect(xml).not.toContain('<p:timing>')
  })

  it('omits <p:timing> when traces do not overlap any shape positions', () => {
    const slide = makeSlideWithAnimations([
      { type: 'fade', duration: 500, delay: 0, x: 2000, y: 2000, w: 10, h: 10 }
    ])
    const imageRels = new Map<string, { rId: string; mediaFile: string }>()
    const xml = buildSlideXml(slide, imageRels, 1)

    expect(xml).not.toContain('<p:timing>')
  })

  it('injects <p:transition> when transitionType is set', () => {
    const slide: HtmlToPptxSlide = {
      texts: [{ text: 'Slide', x: 1, y: 1, w: 5, h: 1, fontSize: 24 }],
      shapes: [],
      images: [],
      tables: [],
      transitionType: 'fade'
    }
    const imageRels = new Map<string, { rId: string; mediaFile: string }>()
    const xml = buildSlideXml(slide, imageRels, 1)

    expect(xml).toContain('<p:transition')
    expect(xml).toContain('<p:fade/>')
    expect(xml).toContain('</p:transition>')
  })

  it('assigns correct shape IDs as animation targets', () => {
    const slide: HtmlToPptxSlide = {
      texts: [{ text: 'Title', x: 1, y: 0.5, w: 11, h: 1, fontSize: 36 }],
      shapes: [],
      images: [],
      tables: [],
      animationTraces: [
        { type: 'fade', duration: 500, delay: 0, x: 60, y: 30, w: 1000, h: 60 }
      ]
    }
    const imageRels = new Map<string, { rId: string; mediaFile: string }>()
    const xml = buildSlideXml(slide, imageRels, 1)

    // The text box gets id=2 (id=1 is the group shape, background image skipped if no rel)
    expect(xml).toContain('name="TextBox 2"')
    // The timing block should reference spid="2"
    const timingMatch = xml.match(/<p:timing>[\s\S]*spid="(\d+)"[\s\S]*<\/p:timing>/)
    expect(timingMatch).toBeTruthy()
    expect(timingMatch![1]).toBe('2')
  })
})
