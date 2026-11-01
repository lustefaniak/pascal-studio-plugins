import { describe, expect, test } from 'bun:test'
import { classify, maskRects, polygonRects } from './mask'

describe('polygonRects', () => {
  test('a rectangle stays one rectangle', () => {
    expect(
      polygonRects([
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
      ]),
    ).toEqual([{ x0: 0, x1: 4, z0: 0, z1: 3 }])
  })

  test('an L splits into two rectangles that cover it exactly', () => {
    const rects = polygonRects([
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 3],
      [0, 3],
    ])
    expect(rects).toEqual([
      { x0: 0, x1: 2, z0: 0, z1: 3 },
      { x0: 2, x1: 4, z0: 0, z1: 2 },
    ])
  })
})

describe('maskRects', () => {
  test('grows each zone rectangle by the margin and skips unknown ids', () => {
    const nodes = {
      zone_a: {
        type: 'zone',
        polygon: [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
        ],
      },
      wall_b: { type: 'wall' },
    }
    expect(maskRects(nodes, ['zone_a', 'wall_b', 'missing'], undefined, 0.5)).toEqual([
      { x0: 0.5, x1: 2.5, z0: 0.5, z1: 2.5 },
    ])
  })

  test('cuts the walls facing the camera down to the cutaway height', () => {
    const nodes = {
      zone_a: {
        type: 'zone',
        polygon: [
          [0, 0],
          [0, 2],
          [2, 2],
          [2, 0],
        ],
      },
    }
    // Camera to the south-east: the east and south walls are cut down.
    const rects = maskRects(
      nodes,
      ['zone_a'],
      { toward: [Math.SQRT1_2, Math.SQRT1_2], height: 0.9 },
      0.5,
    )
    const full = rects.filter((r) => r.top === undefined)
    expect(full).toHaveLength(1)
    expect(full[0]?.x1).toBeCloseTo(1.5)
    expect(full[0]?.z1).toBeCloseTo(1.5)
    const band = rects.filter((r) => r.top === 0.9)
    const area = band.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0)
    expect(area).toBeCloseTo(3 * 3 - 2 * 2)
    // Above the cut, a box in the band is dropped; across it, it is cut.
    expect(classify({ x0: 2.1, x1: 2.2, z0: 0, z1: 1, y0: 1.5, y1: 2.5 }, rects).kind).toBe(
      'outside',
    )
    expect(classify({ x0: 2.1, x1: 2.2, z0: 0, z1: 1, y0: 0, y1: 2.5 }, rects).kind).toBe('cut')
  })

  test('grows an L with square corners, inner corner included', () => {
    const nodes = {
      zone_l: {
        type: 'zone',
        polygon: [
          [0, 0],
          [4, 0],
          [4, 2],
          [2, 2],
          [2, 3],
          [0, 3],
        ],
      },
    }
    const rects = maskRects(nodes, ['zone_l'], undefined, 0.5)
    const area = rects.reduce((sum, r) => sum + (r.x1 - r.x0) * (r.z1 - r.z0), 0)
    // Grown by 0.5 the box is 5 × 4 and the notch keeps its 2 × 1, moved by the margin.
    expect(area).toBeCloseTo(5 * 4 - 2 * 1)
  })
})

describe('classify', () => {
  const rects = [
    { x0: 0, x1: 2, z0: 0, z1: 3 },
    { x0: 2, x1: 4, z0: 0, z1: 2 },
  ]
  test('drops a box that misses every rectangle', () => {
    expect(classify({ x0: 5, x1: 6, z0: 0, z1: 1 }, rects).kind).toBe('outside')
  })
  test('keeps a box inside one rectangle', () => {
    expect(classify({ x0: 0.5, x1: 1.5, z0: 0.5, z1: 1 }, rects).kind).toBe('inside')
  })
  test('cuts a box that crosses the outline, once per rectangle it touches', () => {
    const result = classify({ x0: 1, x1: 5, z0: 1, z1: 1.5 }, rects)
    expect(result).toEqual({ kind: 'cut', rects })
  })
})
