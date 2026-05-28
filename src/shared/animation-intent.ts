export type AnimationIntent =
  | 'none'
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale-in'
  | 'slide-up'
  | 'slide-left'
  | 'pulse'
  | 'shake'
  | 'bounce'
  | 'glow'
  | 'lottie'

export const ANIMATION_INTENTS = [
  'none',
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'scale-in',
  'slide-up',
  'slide-left',
  'pulse',
  'shake',
  'bounce',
  'glow',
  'lottie'
] as const satisfies readonly AnimationIntent[]

const ANIMATION_INTENT_SET = new Set<string>(ANIMATION_INTENTS)

const ANIMATION_GUIDANCE: Record<AnimationIntent, string> = {
  none: 'No animation. Content appears immediately. Best for dense data pages or reference slides.',
  fade: 'Simple opacity fade-in from transparent to opaque.',
  'fade-up': 'Fade in while sliding upward slightly. Good for titles, key statements, and hero text.',
  'fade-down': 'Fade in while sliding downward. Use for headers entering from above.',
  'fade-left': 'Fade in while sliding from right to left. Use for content entering from the side.',
  'fade-right': 'Fade in while sliding from left to right. Use for content entering from the side.',
  'scale-in': 'Scale up from small to full size. Good for central focus elements and hero graphics.',
  'slide-up': 'Slide up from below with full opacity. More pronounced vertical movement than fade-up.',
  'slide-left': 'Slide in horizontally from the right with full opacity.',
  pulse: 'Subtle scale oscillation. Use for key metrics, CTAs, or important numbers.',
  shake: 'Horizontal shake. Use for alert badges, warnings, or attention-grabbing micro-elements.',
  bounce: 'Vertical bounce. Use for icons, decorative elements, or celebratory indicators.',
  glow: 'Opacity pulse (fade in/out). Use for status indicators, live data, or subtle highlights.',
  lottie: 'Complex Lottie animation from JSON. Use for brand motion, icon animations, or custom visual effects. Requires lottieSrc.'
}

export const normalizeAnimationIntent = (value: unknown): AnimationIntent => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
  return ANIMATION_INTENT_SET.has(normalized) ? (normalized as AnimationIntent) : 'none'
}

export const animationIntentGuidance = (intent: AnimationIntent | undefined): string =>
  ANIMATION_GUIDANCE[normalizeAnimationIntent(intent)]

export const formatAnimationIntentPrompt = (intent: AnimationIntent | undefined): string =>
  `Animation intent: ${normalizeAnimationIntent(intent)}.\nAnimation guidance: ${animationIntentGuidance(intent)}`