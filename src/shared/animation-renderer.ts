import type { AnimationIntent } from './animation-intent'

export interface AnimationRenderConfig {
  intent: AnimationIntent
  duration?: number
  delay?: number | string
  trigger?: 'load' | 'click'
  easing?: string
  loop?: boolean
  lottieSrc?: string
  lottieSpeed?: number
  lottieAutoplay?: boolean
  exitType?: string
  exitDuration?: number
  exitDelay?: number
}

export function renderDataAnimAttrs(config: AnimationRenderConfig): Record<string, string> {
  const attrs: Record<string, string> = {}

  if (config.intent === 'none') return attrs

  attrs['data-anim'] = config.intent

  if (config.duration !== undefined) attrs['data-anim-duration'] = String(config.duration)
  if (config.delay !== undefined) attrs['data-anim-delay'] = String(config.delay)
  if (config.trigger && config.trigger !== 'load') attrs['data-anim-trigger'] = config.trigger
  if (config.easing) attrs['data-anim-easing'] = config.easing
  if (config.loop) attrs['data-anim-loop'] = 'true'
  if (config.exitType) attrs['data-anim-out'] = config.exitType
  if (config.exitDuration !== undefined) attrs['data-anim-out-duration'] = String(config.exitDuration)
  if (config.exitDelay !== undefined) attrs['data-anim-out-delay'] = String(config.exitDelay)

  if (config.intent === 'lottie') {
    if (config.lottieSrc) attrs['data-anim-lottie-src'] = config.lottieSrc
    if (config.lottieSpeed !== undefined) attrs['data-anim-lottie-speed'] = String(config.lottieSpeed)
    if (config.lottieAutoplay !== undefined) attrs['data-anim-lottie-autoplay'] = String(config.lottieAutoplay)
  }

  return attrs
}

export function renderDataAnimString(config: AnimationRenderConfig): string {
  const attrs = renderDataAnimAttrs(config)
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')
}