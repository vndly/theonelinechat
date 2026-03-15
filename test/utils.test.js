import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickRandom,
  sanitiseRoomId,
  generateRoomId,
  getRelativeLuminance,
  oklchToHex,
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
