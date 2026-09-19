import {
  contours,
  geoPath,
  interpolateRgbBasis,
  rgb,
  scaleSequential
} from 'd3'
import {
  WORLD_HALF_SIZE_METERS,
  WORLD_SIZE_METERS
} from '@/scenes/outdoor/constants'
import { sampleTerrainHeight } from '@/scenes/outdoor/terrain/generation/sampleTerrain'
import { TERRAIN_GENERATION } from '@/scenes/outdoor/terrain/constants'

const TERRAIN_COLORS = [
  '#263528',
  '#526044',
  '#7e8456',
  '#a89b6d',
  '#d5d0b2'
]

let cachedMapData

function createTerrainMapData () {
  const resolution = TERRAIN_GENERATION.mapResolution
  const values = new Float32Array(resolution * resolution)
  let minHeight = Infinity
  let maxHeight = -Infinity

  for (let row = 0; row < resolution; row += 1) {
    const z = -WORLD_HALF_SIZE_METERS + row / (resolution - 1) * WORLD_SIZE_METERS

    for (let column = 0; column < resolution; column += 1) {
      const x = -WORLD_HALF_SIZE_METERS + column / (resolution - 1) * WORLD_SIZE_METERS
      const height = sampleTerrainHeight(x, z)
      const index = row * resolution + column

      values[index] = height
      minHeight = Math.min(minHeight, height)
      maxHeight = Math.max(maxHeight, height)
    }
  }

  return {
    maxHeight,
    minHeight,
    resolution,
    values
  }
}

function getTerrainMapData () {
  cachedMapData ??= createTerrainMapData()
  return cachedMapData
}

function drawHeightMap (context, mapData, width, height) {
  const { maxHeight, minHeight, resolution, values } = mapData
  const colorScale = scaleSequential(interpolateRgbBasis(TERRAIN_COLORS))
    .domain([TERRAIN_GENERATION.coast.seaLevel, maxHeight])
  const waterScale = scaleSequential(interpolateRgbBasis(['#123a56', '#247e91', '#75b5b3']))
    .domain([minHeight, TERRAIN_GENERATION.coast.seaLevel])
  const sourceCanvas = document.createElement('canvas')
  const sourceContext = sourceCanvas.getContext('2d')

  sourceCanvas.width = resolution
  sourceCanvas.height = resolution

  const imageData = sourceContext.createImageData(resolution, resolution)

  for (let index = 0; index < values.length; index += 1) {
    const color = rgb(values[index] < TERRAIN_GENERATION.coast.seaLevel
      ? waterScale(values[index])
      : colorScale(values[index]))
    const pixelIndex = index * 4

    imageData.data[pixelIndex] = color.r
    imageData.data[pixelIndex + 1] = color.g
    imageData.data[pixelIndex + 2] = color.b
    imageData.data[pixelIndex + 3] = 255
  }

  sourceContext.putImageData(imageData, 0, 0)
  context.imageSmoothingEnabled = true
  context.drawImage(sourceCanvas, 0, 0, width, height)
}

function drawContours (context, mapData, width, height) {
  const { maxHeight, resolution, values } = mapData
  const interval = TERRAIN_GENERATION.contourInterval
  const firstContour = Math.ceil(TERRAIN_GENERATION.coast.seaLevel / interval) * interval
  const thresholds = [TERRAIN_GENERATION.coast.seaLevel]

  for (let heightValue = firstContour; heightValue <= maxHeight; heightValue += interval) {
    thresholds.push(heightValue)
  }

  const contourData = contours()
    .size([resolution, resolution])
    .thresholds(thresholds)(values)
  const scaleX = width / resolution
  const scaleY = height / resolution
  const path = geoPath(null, context)

  context.save()
  context.scale(scaleX, scaleY)
  context.strokeStyle = 'rgba(255, 255, 255, 0.26)'
  context.lineWidth = 0.7 / Math.max(scaleX, scaleY)

  for (const contour of contourData) {
    context.beginPath()
    path(contour)
    context.stroke()
  }

  context.restore()
}

export function drawTerrainMap (canvas) {
  const context = canvas.getContext('2d')
  const mapData = getTerrainMapData()

  context.clearRect(0, 0, canvas.width, canvas.height)
  drawHeightMap(context, mapData, canvas.width, canvas.height)
  drawContours(context, mapData, canvas.width, canvas.height)

  return mapData
}
