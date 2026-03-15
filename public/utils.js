// --- Random ---

export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// --- Room ID ---

const ADJECTIVES = [
  'flying', 'ancient', 'golden', 'electric', 'frozen', 'cosmic', 'blazing',
  'crystal', 'phantom', 'burning', 'silver', 'distant', 'glowing', 'crimson',
  'vivid', 'stormy', 'twisted', 'velvet', 'hollow', 'spectral', 'molten',
  'lunar', 'copper', 'emerald', 'silent',
]

const NOUNS = [
  'mustard', 'thunder', 'nebula', 'falcon', 'prism', 'compass', 'lantern',
  'marble', 'comet', 'canyon', 'circuit', 'harbor', 'eclipse', 'summit',
  'bonfire', 'glacier', 'capsule', 'cipher', 'vortex', 'torrent', 'fossil',
  'riddle', 'anchor', 'tundra', 'labyrinth',
]

export function generateRoomId() {
  const adj1 = pickRandom(ADJECTIVES)
  const adj2 = pickRandom(ADJECTIVES.filter(a => a !== adj1))
  return `${adj1}-${adj2}-${pickRandom(NOUNS)}`
}

export function sanitiseRoomId(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
}

// --- Color ---

function toLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function getRelativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// OKLCH → OKLab → linear LMS → linear sRGB → gamma sRGB → hex
export function oklchToHex(L, C, H) {
  const hRad = H * Math.PI / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3

  const r =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bC = -0.0041960863 * l - 0.7034186147 * m + 1.6956092738 * s

  const encode = c => {
    const gc = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, gc)) * 255).toString(16).padStart(2, '0')
  }

  return `#${encode(r)}${encode(g)}${encode(bC)}`
}

// Binary search for the OKLCH lightness [0,1] that produces a target WCAG luminance
export function findOKLCHLightness(C, H, targetLuminance) {
  let lo = 0, hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    getRelativeLuminance(oklchToHex(mid, C, H)) < targetLuminance ? lo = mid : hi = mid
  }
  return (lo + hi) / 2
}

// Generates a color guaranteed to meet minContrast against the background.
// Works in OKLCH — a perceptually uniform space where equal chroma looks equally
// vivid across all hues, unlike HSL. Picks random hue + chroma, then binary-searches
// for the exact OKLCH lightness that hits the valid WCAG luminance zone.
// minContrast = 3 is WCAG AA Large, appropriate for the 10em text size used here.
//
// Retries on failure: high-chroma colors near the sRGB gamut boundary can cause
// non-monotonicity in the lightness→luminance curve, breaking the binary search
// assumption. If the resulting color misses the target contrast, we resample.
export function generateReadableColor(bgHex, minContrast = 3) {
  const bgLuminance = getRelativeLuminance(bgHex)

  const lightZoneMin = Math.min(1, minContrast * (bgLuminance + 0.05) - 0.05)
  const darkZoneMax = Math.max(0, (bgLuminance + 0.05) / minContrast - 0.05)

  // Use the light zone if it can achieve the required contrast (lightZoneMin < 1)
  // and the background is dark, or the dark zone isn't viable.
  // Falls back to dark zone when the bg is too bright for any sRGB color to reach
  // the required contrast from the light side (e.g. 4.5:1 on a medium bg).
  const useLightZone = lightZoneMin < 1 && (bgLuminance < 0.5 || darkZoneMax <= 0)

  for (let attempt = 0; attempt < 10; attempt++) {
    const hue = Math.random() * 360
    const chroma = 0.1 + Math.random() * 0.12  // 0.10–0.22: vivid but safely within sRGB for most hues

    // Cap light zone at 0.95 to avoid near-white results
    const targetLuminance = useLightZone
      ? lightZoneMin + Math.random() * (0.95 - lightZoneMin)
      : Math.random() * darkZoneMax

    const hex = oklchToHex(findOKLCHLightness(chroma, hue, targetLuminance), chroma, hue)
    const lum = getRelativeLuminance(hex)
    const lighter = Math.max(lum, bgLuminance)
    const darker = Math.min(lum, bgLuminance)
    if ((lighter + 0.05) / (darker + 0.05) >= minContrast) return hex
  }

  // Fallback after exhausting retries: achromatic color at the zone boundary
  const safeLuminance = useLightZone ? Math.min(0.99, lightZoneMin) : Math.max(0, darkZoneMax * 0.5)
  return oklchToHex(findOKLCHLightness(0, 0, safeLuminance), 0, 0)
}
