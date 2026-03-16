import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickRandom,
  sanitiseRoomId,
  generateRoomId,
  getRelativeLuminance,
  oklchToHex,
  findOKLCHLightness,
  generateReadableColor,
  contrastRatio,
} from '../public/utils.js'

// --- pickRandom ---

describe('pickRandom', () => {
  it('returns an element from the array', () => {
    const arr = ['a', 'b', 'c']
    const result = pickRandom(arr)
    assert.ok(arr.includes(result))
  })

  it('returns the only element of a single-item array', () => {
    assert.equal(pickRandom(['only']), 'only')
  })

  it('throws on empty array', () => {
    assert.throws(() => pickRandom([]), /empty array/)
  })

  it('always stays within bounds over many calls', () => {
    const arr = [1, 2, 3, 4, 5]
    for (let i = 0; i < 500; i++) {
      assert.ok(arr.includes(pickRandom(arr)))
    }
  })
})

// --- sanitiseRoomId ---

describe('sanitiseRoomId', () => {
  it('lowercases the input', () => {
    assert.equal(sanitiseRoomId('HELLO'), 'hello')
  })

  it('strips characters that are not a-z, 0-9, or hyphen', () => {
    assert.equal(sanitiseRoomId('hello world!'), 'helloworld')
  })

  it('strips leading and trailing hyphens', () => {
    assert.equal(sanitiseRoomId('--hello--'), 'hello')
  })

  it('preserves valid room IDs unchanged', () => {
    assert.equal(sanitiseRoomId('flying-ancient-mustard'), 'flying-ancient-mustard')
  })

  it('returns empty string for fully invalid input', () => {
    assert.equal(sanitiseRoomId('!!!'), '')
  })

  it('handles spaces by converting them to nothing (stripped)', () => {
    assert.equal(sanitiseRoomId('hello world'), 'helloworld')
  })

  it('handles Firebase-illegal characters like . # $ [ ]', () => {
    assert.equal(sanitiseRoomId('room.name#1'), 'roomname1')
  })
})

// --- generateRoomId ---

describe('generateRoomId', () => {
  it('matches the adj-adj-noun format', () => {
    const id = generateRoomId()
    assert.match(id, /^[a-z]+-[a-z]+-[a-z]+$/)
  })

  it('has exactly two hyphens', () => {
    const id = generateRoomId()
    assert.equal((id.match(/-/g) || []).length, 2)
  })

  it('the two adjectives are different', () => {
    // Run many times to guard against lucky collisions
    for (let i = 0; i < 100; i++) {
      const [adj1, adj2] = generateRoomId().split('-')
      assert.notEqual(adj1, adj2)
    }
  })

  it('produces unique IDs across repeated calls', () => {
    const ids = new Set(Array.from({ length: 50 }, generateRoomId))
    // With 25 adjectives and 25 nouns there are 25*24*25 = 15000 combinations;
    // 50 draws should be almost certainly unique
    assert.ok(ids.size > 40)
  })
})

// --- getRelativeLuminance ---

describe('getRelativeLuminance', () => {
  it('returns 0 for black', () => {
    assert.equal(getRelativeLuminance('#000000'), 0)
  })

  it('returns 1 for white', () => {
    assert.ok(Math.abs(getRelativeLuminance('#ffffff') - 1) < 0.0001)
  })

  it('returns ~0.2126 for pure red', () => {
    assert.ok(Math.abs(getRelativeLuminance('#ff0000') - 0.2126) < 0.001)
  })

  it('returns ~0.7152 for pure green', () => {
    assert.ok(Math.abs(getRelativeLuminance('#00ff00') - 0.7152) < 0.001)
  })

  it('returns ~0.0722 for pure blue', () => {
    assert.ok(Math.abs(getRelativeLuminance('#0000ff') - 0.0722) < 0.001)
  })

  it('returns a value between 0 and 1 for any color', () => {
    const samples = ['#0882bb', '#ff6600', '#123456', '#abcdef']
    for (const hex of samples) {
      const l = getRelativeLuminance(hex)
      assert.ok(l >= 0 && l <= 1, `${hex} luminance out of range: ${l}`)
    }
  })
})

// --- oklchToHex ---

describe('oklchToHex', () => {
  it('returns a 7-character hex string starting with #', () => {
    const hex = oklchToHex(0.5, 0.1, 180)
    assert.match(hex, /^#[0-9a-f]{6}$/)
  })

  it('clamps out-of-gamut values to valid hex (no NaN or overflow)', () => {
    // High chroma values can go out of sRGB gamut
    const hex = oklchToHex(0.9, 0.4, 90)
    assert.match(hex, /^#[0-9a-f]{6}$/)
  })

  it('produces near-black for very low lightness', () => {
    const hex = oklchToHex(0.0, 0.0, 0)
    assert.ok(getRelativeLuminance(hex) < 0.01)
  })

  it('produces near-white for very high lightness and zero chroma', () => {
    const hex = oklchToHex(1.0, 0.0, 0)
    assert.ok(getRelativeLuminance(hex) > 0.9)
  })
})

// --- generateReadableColor (the core contract) ---

describe('generateReadableColor', () => {
  it('returns a 7-character hex string', () => {
    assert.match(generateReadableColor('#0882bb'), /^#[0-9a-f]{6}$/)
  })

  // Parameterized: verify the contrast guarantee holds across a range of backgrounds
  // and minContrast values, including cases that stress the useLightZone decision
  // (medium gray forces a switch to the dark zone for higher contrast requirements).
  const cases = [
    { bg: '#0882bb', minContrast: 3,   label: 'app bg, default contrast' },
    { bg: '#0882bb', minContrast: 4.5, label: 'app bg, 4.5:1 (forces dark zone)' },
    { bg: '#ffffff', minContrast: 3,   label: 'white bg' },
    { bg: '#000000', minContrast: 3,   label: 'black bg' },
    { bg: '#808080', minContrast: 3,   label: 'medium gray bg' },
    { bg: '#808080', minContrast: 4.5, label: 'medium gray bg, 4.5:1' },
  ]

  for (const { bg, minContrast, label } of cases) {
    it(`meets ${minContrast}:1 contrast — ${label}`, () => {
      for (let i = 0; i < 50; i++) {
        const color = generateReadableColor(bg, minContrast)
        const ratio = contrastRatio(color, bg)
        assert.ok(ratio >= minContrast, `contrast ${ratio.toFixed(2)} < ${minContrast} for ${color} on ${bg}`)
      }
    })
  }
})

// --- contrastRatio ---

describe('contrastRatio', () => {
  it('returns ~21 for black on white', () => {
    assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 0.1)
  })

  it('is symmetric — order of arguments does not matter', () => {
    const a = contrastRatio('#0882bb', '#ffffff')
    const b = contrastRatio('#ffffff', '#0882bb')
    assert.ok(Math.abs(a - b) < 0.0001)
  })

  it('returns exactly 1 for the same color against itself', () => {
    assert.equal(contrastRatio('#0882bb', '#0882bb'), 1)
  })

  it('always returns a value >= 1', () => {
    const pairs = [
      ['#000000', '#ffffff'],
      ['#ff0000', '#00ff00'],
      ['#0882bb', '#123456'],
      ['#abcdef', '#fedcba'],
    ]
    for (const [a, b] of pairs) {
      assert.ok(contrastRatio(a, b) >= 1, `contrastRatio(${a}, ${b}) < 1`)
    }
  })
})

// --- findOKLCHLightness ---

describe('findOKLCHLightness', () => {
  it('returns a value in [0, 1]', () => {
    const L = findOKLCHLightness(0, 0, 0.2)
    assert.ok(L >= 0 && L <= 1)
  })

  it('achromatic: produced color has luminance close to target', () => {
    // C=0 makes the OKLCH→sRGB mapping monotone, so binary search is exact
    const targets = [0.05, 0.2, 0.5, 0.8]
    for (const target of targets) {
      const L = findOKLCHLightness(0, 0, target)
      const actual = getRelativeLuminance(oklchToHex(L, 0, 0))
      assert.ok(Math.abs(actual - target) < 0.005, `target ${target}, got ${actual}`)
    }
  })

  it('higher target luminance produces higher lightness (achromatic)', () => {
    const L1 = findOKLCHLightness(0, 0, 0.1)
    const L2 = findOKLCHLightness(0, 0, 0.5)
    const L3 = findOKLCHLightness(0, 0, 0.9)
    assert.ok(L1 < L2 && L2 < L3)
  })

  it('targetLuminance=0 produces near-black', () => {
    const L = findOKLCHLightness(0, 0, 0)
    assert.ok(getRelativeLuminance(oklchToHex(L, 0, 0)) < 0.01)
  })

  it('targetLuminance=1 produces near-white (achromatic)', () => {
    const L = findOKLCHLightness(0, 0, 1)
    assert.ok(getRelativeLuminance(oklchToHex(L, 0, 0)) > 0.98)
  })

  it('works with non-zero chroma and returns a value in [0, 1]', () => {
    for (const hue of [0, 90, 180, 270]) {
      const L = findOKLCHLightness(0.15, hue, 0.4)
      assert.ok(L >= 0 && L <= 1, `hue ${hue}: L=${L} out of range`)
    }
  })
})
