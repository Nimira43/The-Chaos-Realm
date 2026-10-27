import { useEffect, useState } from 'react'
import './wizard.css'

export function NumberBox({ value, onCommit, disabled }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])

  return (
    <input
      className='wz-num'
      type='number'
      inputMode='numeric'
      value={text}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseInt(e.target.value, 10)
        if (!Number.isNaN(n)) setText(String(onCommit(n)))
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

export function Stepper({ value, min, max, onChange, disabled }) {
  const clamp = (n) => Math.min(max, Math.max(min, n))
  return (
    <div className='wz-stepper'>
      <button
        className='wz-step-btn'
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        aria-label='Decrease'
      >
        −
      </button>
      <NumberBox
        value={value}
        disabled={disabled}
        onCommit={(n) => {
          const v = clamp(n)
          onChange(v)
          return v
        }}
      />
      <button
        className='wz-step-btn'
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        aria-label='Increase'
      >
        +
      </button>
    </div>
  )
}
