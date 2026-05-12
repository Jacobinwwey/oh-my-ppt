import { X } from 'lucide-react'
import { Input, Textarea } from '../ui/Input'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../ui/Select'
import type { EditSelectionPayload } from '../preview/edit-mode-script'
import { useT } from '@renderer/i18n'

export interface ElementEditDraft {
  text: string
  color: string
  fontSize: string
  fontWeight: string
}

export function ElementInspectorPanel({
  selection,
  draft,
  onDraftChange,
  onClose
}: {
  selection: EditSelectionPayload | null
  draft: ElementEditDraft
  onDraftChange: (draft: ElementEditDraft) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useT()
  const isText = selection?.isText ?? false

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#d9cfbd]/60 bg-[#fffaf1]/96 shadow-[-8px_0_24px_rgba(93,107,77,0.06)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#dfd2bd]/70 px-3.5 py-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7a875f]">
            {t('sessionDetail.elementInspector')}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[#34402c]">
            {selection ? `<${selection.elementTag}>` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#667257] transition-colors hover:bg-[#e8e0d0]/80 hover:text-[#34402c]"
          aria-label={t('sessionDetail.closeInspector')}
          title={t('sessionDetail.closeInspector')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">
        {/* Bounds info (always shown) */}
        {selection?.bounds && (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#657058]">
              {t('sessionDetail.adjustLayout')}
            </span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[#5a674b]">
              <span>x: {Math.round(selection.bounds.x)}</span>
              <span>y: {Math.round(selection.bounds.y)}</span>
              <span>w: {Math.round(selection.bounds.width)}</span>
              <span>h: {Math.round(selection.bounds.height)}</span>
            </div>
          </div>
        )}

        {/* Text editing (only for text elements) */}
        {isText && (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#657058]">
                {t('sessionDetail.textContent')}
              </span>
              <Textarea
                value={draft.text}
                onChange={(event) => onDraftChange({ ...draft, text: event.target.value })}
                rows={5}
                className="min-h-[136px] resize-none rounded-[12px] border-[#d7cbb7]/80 bg-[#fffdf8]/92 text-[15px] leading-6"
              />
            </label>

            <div className="grid grid-cols-[1fr_104px] gap-2.5">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#657058]">
                  {t('sessionDetail.textColor')}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={draft.color || '#34402c'}
                    onChange={(event) => onDraftChange({ ...draft, color: event.target.value })}
                    className="h-9 w-11 shrink-0 cursor-pointer rounded-[9px] border border-[#d7cbb7]/80 bg-transparent p-1"
                    aria-label={t('sessionDetail.textColor')}
                  />
                  <Input
                    value={draft.color}
                    onChange={(event) => onDraftChange({ ...draft, color: event.target.value })}
                    className="h-9 rounded-[10px] px-2.5 text-xs"
                  />
                </div>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-[#657058]">
                  {t('sessionDetail.fontSize')}
                </span>
                <Input
                  type="number"
                  min={8}
                  max={160}
                  value={draft.fontSize}
                  onChange={(event) => onDraftChange({ ...draft, fontSize: event.target.value })}
                  className="h-9 rounded-[10px] px-2.5 text-xs"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[#657058]">
                {t('sessionDetail.fontWeight')}
              </span>
              <Select
                value={draft.fontWeight}
                onValueChange={(value) => onDraftChange({ ...draft, fontWeight: value })}
              >
                <SelectTrigger className="h-9 rounded-[10px] border-[#d7cbb7]/80 bg-[#fffdf8]/92 px-2.5 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">300</SelectItem>
                  <SelectItem value="400">400</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="600">600</SelectItem>
                  <SelectItem value="700">700</SelectItem>
                  <SelectItem value="800">800</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </>
        )}
      </div>
    </div>
  )
}
