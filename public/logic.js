import { listenChat, updateChat, setRoom, getTakenFonts, registerUser } from './firebase.js'
import {
  pickRandom,
  generateRoomId,
  sanitiseRoomId,
  generateReadableColor,
} from './utils.js'

// --- Identity ---

let uid = localStorage.getItem('uid')
if (!uid) {
  uid = Math.random().toString(36).slice(2, 11)
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
  font = pickRandom(FONTS)
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

// --- Fading constants ---

const FADE_TIMEOUT_MS = 20_000   // time before a character fades (per character, from when it was typed)
const FADE_DURATION_MS = 2_000   // duration of the fade-out animation
const FADE_CHAR_THRESHOLD = 120  // rolling window: oldest char fades when this limit is reached

// --- Routing ---

const roomId = sanitiseRoomId(window.location.pathname.slice(1))
const inputElement = document.getElementById('input')
const displayElement = document.getElementById('display')
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

  // Switch to display mode: hide textarea off-screen, show display div
  inputElement.classList.add('room-hidden')
  displayElement.classList.remove('hidden')
  displayElement.style.color = color
  displayElement.style.fontFamily = font

  // Clicking the display focuses the hidden textarea so the floor holder can type
  displayElement.addEventListener('click', () => {
    if (floorHolder === uid) inputElement.focus()
  })

  try {
    const takenFonts = await getTakenFonts(roomId, uid)
    if (takenFonts.includes(font)) {
      const available = FONTS.filter(f => !takenFonts.includes(f))
      font = available.length > 0
        ? pickRandom(available)
        : font // all fonts taken (>5 users), keep current as fallback
      localStorage.setItem('font', font)
    }
  } catch (e) {
    // keep current font on network/permission error
  }
  registerUser(roomId, uid, font, color)

  let firstUpdate = true
  let floorHolder = null

  // --- Per-character state (floor holder only) ---
  // Each entry: { char, addedAt, fading, el }
  let chars = []
  let charCheckInterval = null

  function startCharChecker() {
    if (charCheckInterval) return
    charCheckInterval = setInterval(checkExpiredChars, 200)
  }

  function stopCharChecker() {
    clearInterval(charCheckInterval)
    charCheckInterval = null
  }

  function checkExpiredChars() {
    const now = Date.now()
    for (const c of chars) {
      if (!c.fading && now - c.addedAt >= FADE_TIMEOUT_MS) startCharFade(c)
    }
  }

  function startCharFade(c) {
    if (c.fading) return
    c.fading = true
    if (c.el) c.el.classList.add('fading')
    setTimeout(() => {
      const idx = chars.indexOf(c)
      if (idx !== -1) chars.splice(idx, 1)
      c.el?.remove()
      c.el = null
      syncTextareaToChars()
      if (floorHolder === uid) broadcastText()
      if (chars.length === 0) stopCharChecker()
    }, FADE_DURATION_MS)
  }

  function addChar(ch) {
    // When the rolling window is full, start fading the oldest active character
    const active = chars.filter(c => !c.fading)
    if (active.length >= FADE_CHAR_THRESHOLD) startCharFade(active[0])

    const c = { char: ch, addedAt: Date.now(), fading: false, el: null }
    chars.push(c)

    const span = document.createElement('span')
    span.className = 'char'
    span.textContent = ch === ' ' ? '\u00A0' : ch
    c.el = span
    const cursor = displayElement.querySelector('.cursor')
    cursor ? displayElement.insertBefore(span, cursor) : displayElement.appendChild(span)

    startCharChecker()
  }

  function removeLastNChars(n) {
    const removed = chars.splice(chars.length - n, n)
    for (const c of removed) {
      c.el?.remove()
      c.el = null
    }
  }

  function clearAllChars() {
    for (const c of chars) {
      c.el?.remove()
      c.el = null
    }
    chars = []
    stopCharChecker()
  }

  function syncTextareaToChars() {
    inputElement.value = chars.map(c => c.char).join('')
  }

  function broadcastText() {
    updateChat({ text: chars.map(c => c.char).join(''), color, font, activeUser: uid })
  }

  // --- Display helpers ---

  // Renders the text as static (non-timed) spans — used for non-floor-holders
  function renderStaticDisplay(text) {
    displayElement.innerHTML = ''
    for (const ch of text) {
      const span = document.createElement('span')
      span.className = 'char'
      span.textContent = ch === ' ' ? '\u00A0' : ch
      displayElement.appendChild(span)
    }
  }

  function showCursor() {
    if (!displayElement.querySelector('.cursor')) {
      const cursor = document.createElement('span')
      cursor.className = 'cursor'
      displayElement.appendChild(cursor)
    }
  }

  function hideCursor() {
    displayElement.querySelector('.cursor')?.remove()
  }

  // --- Floor management ---

  function enableInput() {
    inputElement.removeAttribute('tabindex')
  }

  function disableInput() {
    inputElement.setAttribute('tabindex', '-1')
    inputElement.blur()
  }

  // Global Enter listener — works without clicking the display
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (floorHolder !== uid) {
      floorHolder = uid
      enableInput()
      inputElement.focus()
      displayElement.style.color = color
      displayElement.style.fontFamily = font
    }
    clearAllChars()
    displayElement.innerHTML = ''
    showCursor()
    syncTextareaToChars()
    updateChat({ text: '', color, font, activeUser: uid })
  })

  listenChat(updateInput)

  inputElement.addEventListener('input', event => {
    // Auto-claim floor on first keystroke if unclaimed
    if (!floorHolder) {
      floorHolder = uid
      showCursor()
      displayElement.style.color = color
      displayElement.style.fontFamily = font
    }
    if (floorHolder !== uid) return

    const newValue = event.target.value
    const currentValue = chars.map(c => c.char).join('')
    if (newValue === currentValue) return

    if (newValue.length > currentValue.length) {
      // Characters added — assume at end (no mid-text cursor repositioning)
      for (const ch of newValue.slice(currentValue.length)) addChar(ch)
    } else {
      // Characters removed — assume from end (backspace/delete)
      removeLastNChars(currentValue.length - newValue.length)
    }

    syncTextareaToChars()
    broadcastText()
  })

  function updateInput({ text, color: textColor, font: textFont, activeUser }) {
    const wasHolder = floorHolder === uid
    floorHolder = activeUser
    const iAmHolder = floorHolder === uid
    const floorTaken = floorHolder !== null

    displayElement.style.color = textColor || color
    displayElement.style.fontFamily = textFont || font

    if (wasHolder && !iAmHolder) {
      // Lost the floor — clean up local char state
      clearAllChars()
    }

    if (iAmHolder) {
      // Own update echoing back — chars array is source of truth, don't re-render
      enableInput()
      showCursor()
    } else {
      renderStaticDisplay(text)
      hideCursor()
      if (floorTaken) {
        disableInput()
      } else {
        enableInput()
      }
    }

    if (firstUpdate) {
      firstUpdate = false
      if (!text && !floorTaken) {
        enableInput()
        inputElement.focus()
      }
    }
  }
}
