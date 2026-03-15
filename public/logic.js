import { listenChat, updateChat, setRoom, getTakenFonts, registerUser } from './firebase.js'

// --- Identity ---

let uid = localStorage.getItem('uid')
if (!uid) {
  uid = Math.random().toString(36).substr(2, 9)
  localStorage.setItem('uid', uid)
}

const FONTS = [
  'Verdana, Geneva, sans-serif',
  'Georgia, "Times New Roman", serif',
  '"Courier New", Courier, monospace',
  'Trebuchet MS, Arial, Helvetica, sans-serif',
  '"Palatino Linotype", "Book Antiqua", Palatino, serif',
]

let font = localStorage.getItem('font')
if (!font) {
  font = FONTS[Math.floor(Math.random() * FONTS.length)]
  localStorage.setItem('font', font)
}

let color = localStorage.getItem('color')
if (!color) {
  color = generateReadableColor(getBackgroundColor())
  localStorage.setItem('color', color)
}

function getBackgroundColor() {
  const rgb = getComputedStyle(document.body).backgroundColor
  const match = rgb.match(/\d+/g)
  if (!match) return '#0882bb'
  const [r, g, b] = match.map(Number)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function toLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function getRelativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

// OKLCH → OKLab → linear LMS → linear sRGB → gamma sRGB → hex
function oklchToHex(L, C, H) {
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
function findOKLCHLightness(C, H, targetLuminance) {
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
function generateReadableColor(bgHex, minContrast = 3) {
  const bgLuminance = getRelativeLuminance(bgHex)

  const lightZoneMin = Math.min(1, minContrast * (bgLuminance + 0.05) - 0.05)
  const darkZoneMax = Math.max(0, (bgLuminance + 0.05) / minContrast - 0.05)

  const useLightZone = bgLuminance < 0.5

  const hue = Math.random() * 360
  const chroma = 0.1 + Math.random() * 0.12  // 0.10–0.22: vivid but safely within sRGB for most hues

  // Cap light zone at 0.95 to avoid near-white results
  const targetLuminance = useLightZone
    ? lightZoneMin + Math.random() * (0.95 - lightZoneMin)
    : Math.random() * darkZoneMax

  return oklchToHex(findOKLCHLightness(chroma, hue, targetLuminance), chroma, hue)
}

// --- Room ID generation ---

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

function generateRoomId() {
  const pick = arr => arr[Math.floor(Math.random() * arr.length)]
  const adj1 = pick(ADJECTIVES)
  const adj2 = pick(ADJECTIVES.filter(a => a !== adj1))
  return `${adj1}-${adj2}-${pick(NOUNS)}`
}

// --- Routing ---

function sanitiseRoomId(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')
}

const roomId = sanitiseRoomId(window.location.pathname.slice(1))
const inputElement = document.getElementById('input')
const hintElement = document.getElementById('hint')
const notificationElement = document.getElementById('notification')
const overlayElement = document.getElementById('overlay')

if (roomId) {
  initRoom(roomId)
} else {
  initHomepage()
}

// --- Homepage mode ---

function initHomepage() {
  inputElement.focus()

  // When navigating back, the browser may restore the page from bfcache
  // with the overlay still visible — reset to the initial state in that case
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      overlayElement.classList.remove('visible')
      inputElement.value = ''
      inputElement.focus()
    }
  })

  inputElement.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const value = inputElement.value.trim()
      if (value) {
        const sanitised = sanitiseRoomId(value)
        if (sanitised) window.location.href = '/' + sanitised
      } else {
        createRoom()
      }
    }
  })
}

async function createRoom() {
  inputElement.blur()
  overlayElement.classList.add('visible')
  const id = generateRoomId()
  let copied = false
  try {
    await navigator.clipboard.writeText(id)
    copied = true
  } catch (e) {
    // clipboard unavailable (e.g. non-secure context)
  }
  showNotification(copied ? `${id} · copied to clipboard` : id)
  setTimeout(() => { window.location.href = '/' + id }, 1500)
}

function showNotification(message) {
  notificationElement.textContent = message
  // Force a reflow so the browser registers opacity: 0 before transitioning to 1
  notificationElement.getBoundingClientRect()
  notificationElement.classList.add('visible')
}

// --- Room mode ---

async function initRoom(roomId) {
  setRoom(roomId)
  hintElement.classList.add('hidden')

  const takenFonts = await getTakenFonts(roomId, uid)
  if (takenFonts.includes(font)) {
    const available = FONTS.filter(f => !takenFonts.includes(f))
    font = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : font // all fonts taken (>5 users), keep current as fallback
    localStorage.setItem('font', font)
  }
  registerUser(roomId, uid, font, color)

  let firstUpdate = true
  let floorHolder = null

  // Global Enter listener — works without clicking the input
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (floorHolder === uid) {
      // Clear text but keep the floor
      updateChat({ text: '', color, font, activeUser: uid })
    } else {
      // Claim the floor
      floorHolder = uid
      enableInput()
      inputElement.focus()
      updateChat({ text: '', color, font, activeUser: uid })
    }
  })

  // Live text updates while typing; also claims floor on first keystroke if unclaimed
  inputElement.addEventListener('keyup', function (event) {
    if (event.key === 'Enter') return
    if (!floorHolder) floorHolder = uid
    if (floorHolder === uid) {
      updateChat({ text: inputElement.value, color, font, activeUser: uid })
    }
  })

  listenChat(updateInput)

  inputElement.addEventListener('input', event => {
    const maxLength = 100
    const target = event.target
    if (target.value.length > maxLength) {
      target.value = target.value.slice(0, maxLength)
    }
    updateHeight(target)
  })

  function enableInput() {
    inputElement.style.pointerEvents = ''
    inputElement.removeAttribute('tabindex')
  }

  function disableInput() {
    inputElement.style.pointerEvents = 'none'
    inputElement.setAttribute('tabindex', '-1')
    inputElement.blur()
  }

  function updateInput({ text, color: textColor, font: textFont, activeUser }) {
    inputElement.value = text
    inputElement.style.color = textColor || color
    inputElement.style.fontFamily = textFont || font
    updateHeight(inputElement)

    floorHolder = activeUser
    const iAmHolder = floorHolder === uid
    const floorTaken = floorHolder !== null

    if (floorTaken && !iAmHolder) {
      disableInput()
    } else {
      enableInput()
    }

    if (firstUpdate) {
      firstUpdate = false
      if (!text && !floorTaken) inputElement.focus()
    }
  }
}

function updateHeight(el) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
