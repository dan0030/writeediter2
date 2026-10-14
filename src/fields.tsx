import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { Ban, Check, Plus, Upload, X } from 'lucide-react'
import { normalizeHex } from './constants'

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field-label">
      <span>{children}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

// 컬러코드를 직접 입력할 수 있는 작은 입력칸. 올바른 값일 때만 반영합니다.
function HexInput({ value, onCommit, label }: { value: string; onCommit: (hex: string) => void; label: string }) {
  const [text, setText] = useState(value.toUpperCase())
  useEffect(() => setText(value.toUpperCase()), [value])
  const commit = () => {
    const hex = normalizeHex(text)
    if (hex) onCommit(hex)
    else setText(value.toUpperCase())
  }
  return (
    <input
      className="hex-input"
      value={text}
      maxLength={7}
      spellCheck={false}
      autoCapitalize="characters"
      autoComplete="off"
      inputMode="text"
      aria-label={`${label} 컬러코드`}
      onChange={(e) => {
        setText(e.target.value)
        const hex = normalizeHex(e.target.value)
        if (hex && e.target.value.replace('#', '').length === 6) onCommit(hex)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
    />
  )
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <span>{label}</span>
      <span className="color-value">
        <HexInput value={value} onCommit={onChange} label={label} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} 색상`} />
      </span>
    </div>
  )
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="range-field">
      <span>
        {label}
        <strong>
          {value}
          {suffix}
        </strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export function UploadButton({
  label,
  accept,
  onChange,
  compact = false,
}: {
  label: string
  accept: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  compact?: boolean
}) {
  return (
    <label className={`upload-button${compact ? ' compact' : ''}`}>
      <Upload size={16} />
      <span>{label}</span>
      <input type="file" accept={accept} onChange={onChange} />
    </label>
  )
}

const keepSelection = (e: { preventDefault: () => void }) => e.preventDefault()

export function ColorPanel({
  kind,
  value,
  swatches,
  presets,
  onApply,
  onSavePreset,
  onRemovePreset,
  onClose,
}: {
  kind: 'text' | 'highlight'
  value: string
  swatches: string[]
  presets: string[]
  onApply: (color: string) => void
  onSavePreset: (color: string) => void
  onRemovePreset: (color: string) => void
  onClose: () => void
}) {
  const [hex, setHex] = useState(value.toUpperCase())
  const [invalid, setInvalid] = useState(false)
  useEffect(() => setHex(value.toUpperCase()), [value])
  const label = kind === 'text' ? '글자 색' : '형광펜'
  const parsed = normalizeHex(hex)

  const applyHex = () => {
    if (!parsed) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onApply(parsed)
  }

  const swatch = (color: string, removable: boolean) => (
    <span className="swatch-wrap" key={`${removable ? 'p' : 'd'}-${color}`}>
      <button
        type="button"
        className={`swatch${color.toLowerCase() === value.toLowerCase() ? ' active' : ''}`}
        style={{ background: color }}
        title={color.toUpperCase()}
        aria-label={`${label} ${color.toUpperCase()} 적용`}
        onMouseDown={keepSelection}
        onClick={() => onApply(color)}
      />
      {removable ? (
        <button
          type="button"
          className="swatch-remove"
          aria-label={`${color.toUpperCase()} 프리셋 삭제`}
          onMouseDown={keepSelection}
          onClick={() => onRemovePreset(color)}
        >
          <X size={10} />
        </button>
      ) : null}
    </span>
  )

  return (
    <div className="color-panel" role="dialog" aria-label={`${label} 선택`}>
      <div className="color-panel-head">
        <strong>{label}</strong>
        <small>선택한 글자에 바로 적용돼요</small>
        <button type="button" className="icon-button" aria-label="닫기" onMouseDown={keepSelection} onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="swatch-grid">
        {kind === 'highlight' ? (
          <button
            type="button"
            className="swatch swatch-none"
            title="형광펜 지우기"
            aria-label="형광펜 지우기"
            onMouseDown={keepSelection}
            onClick={() => onApply('transparent')}
          >
            <Ban size={14} />
          </button>
        ) : null}
        {swatches.map((c) => swatch(c, false))}
      </div>
      <div className="preset-label">
        <span>내 프리셋</span>
        <small>{presets.length ? `${presets.length}개 저장됨` : '아래에서 색을 저장해 두세요'}</small>
      </div>
      {presets.length ? <div className="swatch-grid">{presets.map((c) => swatch(c, true))}</div> : null}
      <div className="color-code-row">
        <label className="native-color" title="색 고르기">
          <input
            type="color"
            value={parsed ?? value}
            onChange={(e) => {
              setHex(e.target.value.toUpperCase())
              setInvalid(false)
              onApply(e.target.value)
            }}
            aria-label={`${label} 직접 고르기`}
          />
          <i style={{ background: parsed ?? value }} />
        </label>
        <input
          className={`hex-input wide${invalid ? ' invalid' : ''}`}
          value={hex}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="#RRGGBB"
          aria-label={`${label} 컬러코드 입력`}
          onChange={(e) => {
            setHex(e.target.value)
            setInvalid(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applyHex()
            }
          }}
        />
        <button type="button" className="mini-button" onMouseDown={keepSelection} onClick={applyHex}>
          <Check size={14} />
          적용
        </button>
        <button
          type="button"
          className="mini-button"
          title="현재 색을 프리셋에 저장"
          onMouseDown={keepSelection}
          onClick={() => {
            if (!parsed) {
              setInvalid(true)
              return
            }
            onSavePreset(parsed)
          }}
        >
          <Plus size={14} />
          저장
        </button>
      </div>
      {invalid ? <p className="color-error">#FFAA00 또는 FA0 같은 형식으로 입력해 주세요.</p> : null}
    </div>
  )
}
