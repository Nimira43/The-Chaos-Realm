const SKY = '#87ceeb'
const RIDE = '#3cb043'
const AP_LEFT = '#ffe14d'

const PALETTE = {
  player: { light: '#4f7dff', dark: '#14297a', tint: '#7fa6ff' },
  enemy: { light: '#f0483a', dark: '#7a120c', tint: '#ff9a8f' },
}

function healthColour(fraction) {
  if (fraction > 0.6) return '#4fd45a'
  if (fraction > 0.3) return '#ffb020'
  return '#ff3b30'
}

function drawHat(ctx, cx, cy, s) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineWidth = 1.5 * s
  ctx.strokeStyle = '#3a2a00'
  ctx.fillStyle = '#ffd479'

  // cone with a bent tip
  ctx.beginPath()
  ctx.moveTo(cx - 8 * s, cy + 5 * s)
  ctx.quadraticCurveTo(cx - 3 * s, cy - 2 * s, cx + 4 * s, cy - 12 * s)
  ctx.quadraticCurveTo(cx + 6 * s, cy - 8 * s, cx + 8 * s, cy + 5 * s)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  // brim
  ctx.beginPath()
  ctx.ellipse(cx, cy + 5.5 * s, 12 * s, 3.5 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // band
  ctx.fillStyle = '#3a2a00'
  ctx.fillRect(cx - 6.5 * s, cy + 0.5 * s, 13 * s, 2 * s)
  ctx.restore()
}

function drawPip(ctx, x, y, s, letter, colour) {
  ctx.beginPath()
  ctx.arc(x, y, 7 * s, 0, Math.PI * 2)
  ctx.fillStyle = colour
  ctx.fill()
  ctx.lineWidth = 1.5 * s
  ctx.strokeStyle = '#0a0a0a'
  ctx.stroke()

  ctx.fillStyle = '#000'
  ctx.font = `bold ${Math.round(10 * s)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, x, y + 0.5 * s)
}

export function drawCounter(ctx, cx, cy, tileSize, opts) {
  const { owner, kind, code, hp, hpMax, apLeft, mount } = opts
  const s = tileSize / 48
  const pal = PALETTE[owner] || PALETTE.enemy

  ctx.save()

  if (mount) {
    ctx.beginPath()
    ctx.arc(cx, cy, 23.4 * s, 0, Math.PI * 2)
    ctx.lineWidth = 1.6 * s
    ctx.strokeStyle = mount === 'flying' ? SKY : RIDE
    ctx.stroke()
  }

  const frac = hpMax > 0 ? Math.max(0, Math.min(1, hp / hpMax)) : 1
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.arc(cx, cy, 22.4 * s, 0, Math.PI * 2)
  ctx.lineWidth = 1.2 * s
  ctx.strokeStyle = '#000'
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, 20 * s, 0, Math.PI * 2)
  ctx.lineWidth = 4 * s
  ctx.strokeStyle = '#161616'
  ctx.stroke()

  if (frac > 0) {
    const start = -Math.PI / 2
    ctx.beginPath()
    ctx.arc(cx, cy, 20 * s, start, start + Math.PI * 2 * frac)
    ctx.lineWidth = 4 * s
    ctx.strokeStyle = healthColour(frac)
    ctx.stroke()
  }

  // disc
  const discR = 16.5 * s
  const grad = ctx.createRadialGradient(
    cx - 5 * s,
    cy - 6 * s,
    2 * s,
    cx,
    cy,
    discR,
  )
  grad.addColorStop(0, pal.light)
  grad.addColorStop(1, pal.dark)
  ctx.beginPath()
  ctx.arc(cx, cy, discR, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // rim
  ctx.beginPath()
  ctx.arc(cx, cy, discR, 0, Math.PI * 2)
  if (apLeft) {
    ctx.lineWidth = 3 * s
    ctx.strokeStyle = AP_LEFT
  } else {
    ctx.lineWidth = 1.5 * s
    ctx.strokeStyle = pal.tint
  }
  ctx.stroke()

  // face
  if (kind === 'wizard') {
    drawHat(ctx, cx, cy - 1 * s, s)
  } else {
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(13 * s)}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.7)'
    ctx.shadowBlur = 2 * s
    ctx.fillText(code || '?', cx, cy + 1 * s)
    ctx.shadowBlur = 0
  }

  if (mount) {
    const a = (-135 * Math.PI) / 180
    drawPip(
      ctx,
      cx + Math.cos(a) * 19 * s,
      cy + Math.sin(a) * 19 * s,
      s,
      mount === 'flying' ? 'F' : 'R',
      mount === 'flying' ? SKY : RIDE,
    )
  }

  ctx.restore()
}
