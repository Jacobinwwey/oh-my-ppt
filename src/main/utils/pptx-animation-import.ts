import { unzipSync } from 'fflate'
import * as cheerio from 'cheerio'

export type ImportedAnimationType =
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale-in'
  | 'slide-up'
  | 'slide-left'
  | 'fly-in'
  | 'wipe'
  | 'zoom-in'
  | 'spin-in'
  | 'grow-shrink'
  | 'pulse'
  | 'exit-fade'
  | 'exit-fly'
  | 'path'

export type ImportedAnimationTrigger = 'load' | 'click'
export type ImportedAnimationFrom = 'left' | 'right' | 'top' | 'bottom' | 'center'

export type ImportedElementAnimation = {
  id: number
  type: ImportedAnimationType
  trigger: ImportedAnimationTrigger
  from?: ImportedAnimationFrom
  duration: number
  delay: number
  sourceId: string
  sourceName?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

export type SlideAnimationPlan = {
  animations: ImportedElementAnimation[]
  byName: Map<string, ImportedElementAnimation[]>
}

type ParsedSlideShapeTarget = {
  spid: string
  name?: string
  x?: number
  y?: number
  w?: number
  h?: number
}

export const normalizePptxShapeName = (value: unknown): string =>
  String(value || '').replace(/\s+/g, ' ').trim()

const clampMs = (value: unknown, fallback: number): number => {
  const n = Number(value)
  return Math.round(Math.max(100, Math.min(5000, Number.isFinite(n) ? n : fallback)))
}

const normalizeAnimationType = (
  presetId: string | undefined,
  presetSubtype: string | undefined,
  presetClass: string | undefined,
  hasScale: boolean,
  effectFilter: string | undefined
): ImportedAnimationType => {
  if (presetClass === 'exit') {
    if (presetId === '2') return 'exit-fly'
    return 'exit-fade'
  }
  if (presetClass === 'emph' && hasScale) return 'pulse'
  if (effectFilter?.startsWith('wipe') || presetId === '5') return 'wipe'
  if (hasScale) return 'scale-in'
  if (presetId === '10') return 'fade'
  if (presetId === '2') {
    switch (presetSubtype) {
      case '1':
        return 'fade-down'
      case '2':
        return 'fade-right'
      case '3':
      case '4':
        return 'fade-left'
      case '8':
        return 'fade-up'
      default:
        return 'fade-up'
    }
  }
  return 'fade'
}

const normalizeAnimationFrom = (
  presetSubtype: string | undefined,
  effectFilter: string | undefined
): ImportedAnimationFrom | undefined => {
  if (effectFilter?.startsWith('wipe')) {
    if (effectFilter.includes('(l)')) return 'right'
    if (effectFilter.includes('(r)')) return 'left'
    if (effectFilter.includes('(u)')) return 'bottom'
    if (effectFilter.includes('(d)')) return 'top'
  }
  switch (presetSubtype) {
    case '1':
      return 'top'
    case '2':
      return 'left'
    case '3':
    case '4':
      return 'right'
    case '8':
      return 'bottom'
    default:
      return undefined
  }
}

const parseNumericDelay = (value: string | undefined): number => {
  if (!value || value === 'indefinite') return 0
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.min(30000, Math.round(n))) : 0
}

const readXmlAttrNumber = (value: string | undefined): number | undefined => {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const readSlideEmuSize = (
  files: Record<string, Uint8Array>
): { cx: number; cy: number } | null => {
  const presentation = files['ppt/presentation.xml']
  if (!presentation) return null
  const $ = cheerio.load(Buffer.from(presentation).toString('utf-8'), { xmlMode: true })
  const slideSize = $('p\\:sldSz').first()
  const cx = readXmlAttrNumber(slideSize.attr('cx'))
  const cy = readXmlAttrNumber(slideSize.attr('cy'))
  return cx && cy ? { cx, cy } : null
}

const collectSlideShapeTargets = (
  $: cheerio.CheerioAPI,
  slideEmuSize: { cx: number; cy: number } | null,
  slideSize: { width: number; height: number }
): Map<string, ParsedSlideShapeTarget> => {
  const targets = new Map<string, ParsedSlideShapeTarget>()
  $('p\\:cNvPr').each((_, node) => {
    const item = $(node)
    const spid = item.attr('id')
    if (!spid || spid === '1') return
    const name = normalizePptxShapeName(item.attr('name'))
    const container = item.closest('p\\:sp,p\\:pic,p\\:graphicFrame,p\\:grpSp,p\\:cxnSp')
    const xfrm = container.find('a\\:xfrm').first()
    const off = xfrm.find('a\\:off').first()
    const ext = xfrm.find('a\\:ext').first()
    const xEmu = readXmlAttrNumber(off.attr('x'))
    const yEmu = readXmlAttrNumber(off.attr('y'))
    const wEmu = readXmlAttrNumber(ext.attr('cx'))
    const hEmu = readXmlAttrNumber(ext.attr('cy'))
    const box =
      slideEmuSize && xEmu !== undefined && yEmu !== undefined && wEmu !== undefined && hEmu !== undefined
        ? {
            x: (xEmu / slideEmuSize.cx) * slideSize.width,
            y: (yEmu / slideEmuSize.cy) * slideSize.height,
            w: (wEmu / slideEmuSize.cx) * slideSize.width,
            h: (hEmu / slideEmuSize.cy) * slideSize.height
          }
        : {}
    targets.set(spid, {
      spid,
      name: name || undefined,
      ...box
    })
  })
  return targets
}

export const parsePptxSlideAnimationPlan = (
  slideXml: string,
  slideEmuSize: { cx: number; cy: number } | null,
  slideSize: { width: number; height: number }
): SlideAnimationPlan => {
  const $ = cheerio.load(slideXml, { xmlMode: true })
  const targets = collectSlideShapeTargets($, slideEmuSize, slideSize)
  const animations: ImportedElementAnimation[] = []
  let id = 0

  $('[presetID]').each((_, node) => {
    const ctn = $(node)
    const nodeType = ctn.attr('nodeType')
    const presetId = ctn.attr('presetID')
    const presetSubtype = ctn.attr('presetSubtype')
    const presetClass = ctn.attr('presetClass')
    const effectFilter = ctn.find('p\\:animEffect').first().attr('filter')
    const type = normalizeAnimationType(
      presetId,
      presetSubtype,
      presetClass,
      ctn.find('p\\:animScale').length > 0,
      effectFilter
    )
    const from = normalizeAnimationFrom(presetSubtype, effectFilter)
    const trigger: ImportedAnimationTrigger = nodeType === 'clickEffect' ? 'click' : 'load'
    const delay = parseNumericDelay(
      ctn.children('p\\:stCondLst').find('p\\:cond').first().attr('delay')
    )
    const duration =
      ctn
        .find('p\\:cTn[dur]')
        .map((__, child) => $(child).attr('dur'))
        .get()
        .map((value) => Number(value))
        .find((value) => Number.isFinite(value) && value > 1) ?? 500
    const spids = [
      ...new Set(
        ctn
          .find('p\\:spTgt')
          .map((__, target) => $(target).attr('spid'))
          .get()
          .filter(Boolean)
      )
    ]
    for (const spid of spids) {
      const target = targets.get(spid)
      id += 1
      animations.push({
        id,
        type,
        trigger,
        from,
        duration: clampMs(duration, 500),
        delay,
        sourceId: spid,
        sourceName: target?.name,
        x: target?.x,
        y: target?.y,
        w: target?.w,
        h: target?.h
      })
    }
  })

  const byName = new Map<string, ImportedElementAnimation[]>()
  for (const animation of animations) {
    const name = normalizePptxShapeName(animation.sourceName)
    if (!name) continue
    const list = byName.get(name) || []
    list.push(animation)
    byName.set(name, list)
  }
  return { animations, byName }
}

export const readPptxAnimationPlans = (
  buffer: Buffer,
  slideCount: number,
  slideSize: { width: number; height: number }
): SlideAnimationPlan[] => {
  try {
    const files = unzipSync(new Uint8Array(buffer))
    const slideEmuSize = readSlideEmuSize(files)
    return Array.from({ length: slideCount }, (_, index) => {
      const slideXml = files[`ppt/slides/slide${index + 1}.xml`]
      if (!slideXml) return { animations: [], byName: new Map() }
      return parsePptxSlideAnimationPlan(
        Buffer.from(slideXml).toString('utf-8'),
        slideEmuSize,
        slideSize
      )
    })
  } catch {
    return Array.from({ length: slideCount }, () => ({ animations: [], byName: new Map() }))
  }
}
