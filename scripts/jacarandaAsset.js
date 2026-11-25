import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js'

const directory = 'assets/models/vegetation/jacaranda_tree'
const runtimePath = `${directory}/jacaranda_tree_runtime.glb`

// Keep more detail in the canopy and use smaller error limits on the bark.
const meshBudgets = {
  jacaranda_tree_branches: { triangles: 45000, error: 0.025 },
  jacaranda_tree_trunk: { triangles: 13000, error: 0.025 },
  jacaranda_tree_leaves: { triangles: 200000, error: 0.055 }
}

function encodeGlb (model, buffers) {
  const json = Buffer.from(JSON.stringify(model))
  const jsonLength = Math.ceil(json.length / 4) * 4
  const binLength = model.buffers[0].byteLength
  const result = Buffer.alloc(28 + jsonLength + binLength)
  result.write('glTF', 0)
  result.writeUInt32LE(2, 4)
  result.writeUInt32LE(result.length, 8)
  result.writeUInt32LE(jsonLength, 12)
  result.write('JSON', 16)
  result.fill(0x20, 20, 20 + jsonLength)
  json.copy(result, 20)
  result.writeUInt32LE(binLength, 20 + jsonLength)
  result.write('BIN\0', 24 + jsonLength)
  buffers.forEach(({ bytes, offset }) => bytes.copy(result, 28 + jsonLength + offset))
  return result
}

async function createRuntimeTree (publicDir) {
  if (!publicDir) return null
  const sourcePath = join(publicDir, directory, 'jacaranda_tree_1k.gltf')
  let source
  let geometry
  try {
    source = JSON.parse(await readFile(sourcePath, 'utf8'))
    geometry = await readFile(join(publicDir, directory, source.buffers[0].uri))
  } catch (error) {
    // The tree is optional when the original asset pack is unavailable.
    if (error.code === 'ENOENT') return null
    throw error
  }
  await MeshoptSimplifier.ready

  const accessors = []
  const bufferViews = []
  const buffers = []
  let byteLength = 0

  function readAccessor (index) {
    const accessor = source.accessors[index]
    const view = source.bufferViews[accessor.bufferView]
    // The source asset has a dedicated, tightly packed view for each accessor.
    const bytes = geometry.subarray(view.byteOffset, view.byteOffset + view.byteLength)
    return { accessor, bytes, target: view.target }
  }

  function writeAccessor (bytes, target, accessor) {
    const index = accessors.length
    accessors.push({ ...accessor, bufferView: index })
    bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.length, target })
    buffers.push({ bytes, offset: byteLength })
    byteLength += Math.ceil(bytes.length / 4) * 4
    return index
  }

  const meshes = source.meshes.map((mesh) => ({
    ...mesh,
    primitives: mesh.primitives.map((primitive) => {
      const budget = meshBudgets[source.materials[primitive.material].name]
      const positionBytes = readAccessor(primitive.attributes.POSITION).bytes
      const positions = new Float32Array(positionBytes.buffer, positionBytes.byteOffset, positionBytes.length / 4)
      const { accessor: indexAccessor, bytes: indexBytes, target } = readAccessor(primitive.indices)
      const sourceIndices = new Uint32Array(indexBytes.buffer, indexBytes.byteOffset, indexAccessor.count)
      const targetCount = Math.min(sourceIndices.length, budget.triangles * 3)
      const [indices] = MeshoptSimplifier.simplify(sourceIndices, positions, 3, targetCount, budget.error, ['Permissive', 'Prune', 'ErrorAbsolute'])
      const [remap, vertexCount] = MeshoptSimplifier.compactMesh(indices)
      const packedIndices = vertexCount <= 65536 ? new Uint16Array(indices) : indices
      const packedIndexBytes = Buffer.from(packedIndices.buffer, packedIndices.byteOffset, packedIndices.byteLength)
      const index = writeAccessor(packedIndexBytes, target, {
        ...indexAccessor, count: indices.length, componentType: packedIndices.BYTES_PER_ELEMENT === 2 ? 5123 : 5125
      })

      // Three's tree materials only use the first vertex color channel.
      const attributes = {}
      for (const semantic of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']) {
        const { accessor, bytes, target } = readAccessor(primitive.attributes[semantic])
        const stride = bytes.length / accessor.count
        const packed = Buffer.allocUnsafe(vertexCount * stride)
        for (let original = 0; original < remap.length; original++) {
          const vertex = remap[original]
          if (vertex >= vertexCount) continue
          bytes.copy(packed, vertex * stride, original * stride, (original + 1) * stride)
        }
        const bounds = semantic === 'POSITION' ? positionBounds(packed) : {}
        attributes[semantic] = writeAccessor(packed, target, { ...accessor, ...bounds, count: vertexCount })
      }
      return { ...primitive, attributes, indices: index }
    })
  }))

  // Keep the existing external textures relative to the model's directory.
  return encodeGlb({ ...source, accessors, bufferViews, meshes, buffers: [{ byteLength }] }, buffers)
}

function positionBounds (bytes) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let offset = 0; offset < bytes.length; offset += 12) {
    for (let axis = 0; axis < 3; axis++) {
      const value = bytes.readFloatLE(offset + axis * 4)
      min[axis] = Math.min(min[axis], value)
      max[axis] = Math.max(max[axis], value)
    }
  }
  return { min, max }
}

export function jacarandaAsset () {
  let publicDir
  return {
    name: 'wildframe-jacaranda-asset',
    configResolved (config) {
      publicDir = config.publicDir
    },
    configureServer (server) {
      let runtimeTree
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== `${server.config.base}${runtimePath}`) return next()
        try {
          runtimeTree ??= createRuntimeTree(publicDir)
          const asset = await runtimeTree
          if (!asset) {
            runtimeTree = null
            response.statusCode = 404
            response.end()
            return
          }
          response.setHeader('Content-Type', 'model/gltf-binary')
          response.setHeader('Content-Length', asset.length)
          response.end(request.method === 'HEAD' ? undefined : asset)
        } catch (error) {
          runtimeTree = null
          next(error)
        }
      })
    },
    async generateBundle () {
      const source = await createRuntimeTree(publicDir)
      if (source) this.emitFile({ type: 'asset', fileName: runtimePath, source })
    }
  }
}
