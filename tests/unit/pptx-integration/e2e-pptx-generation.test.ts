import { describe, it, expect, afterAll } from 'vitest'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { unzipSync } from 'fflate'
import { writePptxDocument } from '../../../src/main/utils/html-pptx/ooxml-writer'
import type { HtmlToPptxDocument, HtmlToPptxSlide } from '../../../src/main/utils/html-pptx/types'

const TMP_PPTX = join('/tmp', 'e2e-test-anim.pptx')

afterAll(() => {
  if (existsSync(TMP_PPTX)) unlinkSync(TMP_PPTX)
})

describe('E2E: generate PPTX and verify animation in slide XML', () => {
  function buildDoc(slides: HtmlToPptxSlide[]): HtmlToPptxDocument {
    return { title: 'E2E Test', slides }
  }

  function unzipAndGetSlideXml(path: string): string {
    const buf = readFileSync(path)
    const files = unzipSync(new Uint8Array(buf))
    const slideXml = files['ppt/slides/slide1.xml']
    expect(slideXml, 'slide1.xml must exist in PPTX').toBeDefined()
    return new TextDecoder().decode(slideXml)
  }

  it('writes <p:timing> into real PPTX file when animationTraces match shapes', () => {
    const slide: HtmlToPptxSlide = {
      title: 'Animated',
      texts: [
        { text: 'Title', x: 1, y: 0.5, w: 11, h: 1.2, fontSize: 36 },
        { text: 'Subtitle', x: 1, y: 3, w: 11, h: 2, fontSize: 18 }
      ],
      shapes: [],
      images: [],
      tables: [],
      animationTraces: [
        { type: 'fade-up', trigger: 'load', from: 'bottom', duration: 500, delay: 0, order: 0, x: 60, y: 30, w: 1000, h: 70 },
        { type: 'fade', trigger: 'load', duration: 400, delay: 200, order: 1, x: 60, y: 180, w: 1000, h: 120 }
      ]
    }

    writePptxDocument(TMP_PPTX, buildDoc([slide]))

    const xml = unzipAndGetSlideXml(TMP_PPTX)

    expect(xml).toContain('<p:timing>')
    expect(xml).toContain('</p:timing>')
    expect(xml).toContain('presetID=')
    expect(xml).toContain('ppt_x')
    expect(xml).toContain('ppt_y')

    const spidMatches = xml.match(/spid="(\d+)"/g)
    expect(spidMatches, 'should have spid references in timing').toBeTruthy()
    const spidValues = spidMatches!.map(m => m.match(/"(\d+)"/)![1])
    for (const spid of spidValues) {
      expect(xml).toContain(`id="${spid}"`)
    }
  })

  it('writes <p:transition> into real PPTX file when transitionType is set', () => {
    const slide: HtmlToPptxSlide = {
      title: 'Transition Test',
      texts: [{ text: 'Hello', x: 1, y: 1, w: 5, h: 1, fontSize: 24 }],
      shapes: [],
      images: [],
      tables: [],
      transitionType: 'fade'
    }

    writePptxDocument(TMP_PPTX, buildDoc([slide]))

    const xml = unzipAndGetSlideXml(TMP_PPTX)

    expect(xml).toContain('<p:transition')
    expect(xml).toContain('<p:fade/>')
    expect(xml).toContain('</p:transition>')
  })

  it('produces valid PPTX without animation when no traces', () => {
    const slide: HtmlToPptxSlide = {
      title: 'No Anim',
      texts: [{ text: 'Static', x: 1, y: 1, w: 5, h: 1, fontSize: 24 }],
      shapes: [],
      images: [],
      tables: []
    }

    writePptxDocument(TMP_PPTX, buildDoc([slide]))

    const xml = unzipAndGetSlideXml(TMP_PPTX)

    expect(xml).not.toContain('<p:timing>')
    expect(xml).not.toContain('<p:transition')
    expect(xml).toContain('<p:sld')
    expect(xml).toContain('</p:sld>')
  })

  it('binds animation to the correct shape ID via position overlap', () => {
    const slide: HtmlToPptxSlide = {
      title: 'ID Binding',
      texts: [{ text: 'Target', x: 1, y: 0.5, w: 11, h: 1, fontSize: 36 }],
      shapes: [],
      images: [],
      tables: [],
      animationTraces: [
        { type: 'fade', trigger: 'load', duration: 500, delay: 0, order: 0, x: 60, y: 30, w: 1000, h: 60 }
      ]
    }

    writePptxDocument(TMP_PPTX, buildDoc([slide]))

    const xml = unzipAndGetSlideXml(TMP_PPTX)

    expect(xml).toContain('name="TextBox 2"')

    const timingSection = xml.substring(xml.indexOf('<p:timing>'), xml.indexOf('</p:timing>'))
    const spidMatch = timingSection.match(/spid="(\d+)"/)
    expect(spidMatch).toBeTruthy()
    expect(spidMatch![1]).toBe('2')
  })
})
