import { useEffect, useRef } from 'react'
import { drawTerrainMap } from '@/scenes/outdoor/ui/map/drawTerrainMap'

const CANVAS_SIZE = 512

export function TerrainMapCanvas () {
  const canvasRef = useRef()

  useEffect(() => {
    drawTerrainMap(canvasRef.current)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-label='World terrain height map'
      className='h-full w-full'
      height={CANVAS_SIZE}
      width={CANVAS_SIZE}
    />
  )
}
