import { useEffect } from 'react'
import { drawViewport } from './viewport.js'
import { PLAYER } from '../data/player.js'

export function useViewportRenderer(canvasRef, terrainLayer, objectLayer, cursor, selected) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !terrainLayer.length) return

    const ctx = canvas.getContext('2d')
    const TILE_SIZE = 48
    const VIEW_TILES = 15

    function render() {
      drawViewport(
        ctx,
        terrainLayer,
        PLAYER,
        TILE_SIZE,
        VIEW_TILES,
        cursor,
        selected,
        objectLayer
      )
    }

    render()

    const interval = setInterval(render, 100)
    return () => clearInterval(interval)
  }, [canvasRef, terrainLayer, objectLayer, cursor, selected])
}
