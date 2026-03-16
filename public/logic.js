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

// --- Font size constants ---

const FONT_SIZE_DEFAULT = 10   // em, matches the CSS default
const FONT_SIZE_MIN = 1        // em, smallest allowed before text becomes unreadable

// --- Fading constants ---

const FADE_TIMEOUT_MS = 10_000   // time before a character fades (per character, from when it was typed)
const FADE_DURATION_MS = 600   // duration of the fade-out animation
const FADE_CHAR_THRESHOLD = 200  // rolling window: oldest char fades when this limit is reached

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

  // Prevent the browser from stealing focus or starting a text selection on the
  // display div when clicked — the blur listener on the textarea handles re-focus.
  displayElement.addEventListener('mousedown', event => {
    event.preventDefault()
  })

  // Mobile: claim the floor and focus the textarea synchronously inside the
  // touchstart gesture handler. Programmatic focus() is only honoured on mobile
  // browsers when called directly within a user-gesture callback (not inside
  // requestAnimationFrame, setTimeout, or after an async round-trip).
  displayElement.addEventListener('touchstart', event => {
    event.preventDefault()
    claimFloorAndStart()
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
  let floorClaimedAt = 0   // timestamp of the most recent floor claim seen by this client
  let myClaimedAt = 0      // timestamp of when this client claimed the floor

  // --- Spectator display state ---
  // Tracks spans currently in the display for non-floor-holders, including
  // invisible ghost spans kept for layout stability when chars have faded.
  let spectatorSpans = []
  let spectatorText = ''

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
      if (idx === -1) return  // already cleared (e.g. Enter was pressed) — bail out
      chars.splice(idx, 1)
      // Keep the invisible span in the DOM so the layout doesn't shift.
      // Only clear everything once the last char has faded.
      syncTextareaToChars()
      if (floorHolder === uid) broadcastText()
      if (chars.length === 0) {
        displayElement.innerHTML = ''
        displayElement.classList.remove('has-content')
        resetFontSize()
        stopCharChecker()
      } else {
        adjustFontSize()
      }
    }, FADE_DURATION_MS)
  }

  function addChar(ch) {
    // When the rolling window is full, start fading the oldest active character
    const active = chars.filter(c => !c.fading)
    if (active.length >= FADE_CHAR_THRESHOLD) startCharFade(active[0])

    const c = { char: ch, addedAt: Date.now(), fading: false, el: null }
    chars.push(c)

    const span = makeCharSpan(ch)
    c.el = span
    const cursor = displayElement.querySelector('.cursor')
    cursor ? displayElement.insertBefore(span, cursor) : displayElement.appendChild(span)
    displayElement.classList.add('has-content')
    adjustFontSize()
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
    spectatorSpans = []
    spectatorText = ''
    resetFontSize()
    displayElement.innerHTML = ''
    displayElement.classList.remove('has-content')
    stopCharChecker()
  }

  // --- Helpers ---

  function makeCharSpan(ch) {
    const span = document.createElement('span')
    span.className = 'char'
    span.textContent = ch === ' ' ? '\u00A0' : ch
    return span
  }

  // --- Font size adjustment ---

  let currentFontSize = FONT_SIZE_DEFAULT

  function resetFontSize() {
    currentFontSize = FONT_SIZE_DEFAULT
    displayElement.style.fontSize = ''
  }

  function adjustFontSize() {
    requestAnimationFrame(() => {
      if (!displayElement.classList.contains('has-content')) return

      const contentHeight = displayElement.scrollHeight
      const windowHeight = window.innerHeight
      if (contentHeight === 0) return

      // Only shrink — never grow back until the display is fully cleared.
      if (contentHeight <= windowHeight) return

      const target = Math.max(FONT_SIZE_MIN, currentFontSize * (windowHeight / contentHeight))
      currentFontSize = target
      displayElement.style.fontSize = currentFontSize + 'em'
    })
  }

  window.addEventListener('resize', adjustFontSize)

  function syncTextareaToChars() {
    inputElement.value = chars.map(c => c.char).join('')
  }

  function broadcastText() {
    updateChat({ text: chars.map(c => c.char).join(''), color, font, activeUser: uid, claimedAt: myClaimedAt })
  }

  // --- Display helpers ---

  // Updates the display for spectators. Instead of rebuilding from scratch on
  // every update, it diffs against the previously rendered state so that chars
  // which have faded on the floor-holder's side are kept as invisible ghost spans
  // here too — preventing layout shifts as the text drains away.
  function renderStaticDisplay(text) {
    if (text === spectatorText) return

    if (text === '') {
      displayElement.innerHTML = ''
      displayElement.classList.remove('has-content')
      resetFontSize()
      spectatorSpans = []
      spectatorText = ''
      return
    }

    // Number of invisible ghost spans already sitting at the front of the display
    const ghostCount = spectatorSpans.length - spectatorText.length

    if (text.length < spectatorText.length) {
      const removed = spectatorText.length - text.length
      if (spectatorText.endsWith(text)) {
        // Oldest chars faded — mark the corresponding spans invisible
        for (let i = ghostCount; i < ghostCount + removed; i++) {
          spectatorSpans[i].classList.add('fading')
        }
        spectatorText = text
        return
      }
      if (spectatorText.startsWith(text)) {
        // Chars deleted from the end (backspace) — remove those spans immediately
        const removed = spectatorSpans.splice(ghostCount + text.length)
        for (const span of removed) span.remove()
        spectatorText = text
        return
      }
    } else if (text.startsWith(spectatorText)) {
      // Chars added at the end
      for (const ch of text.slice(spectatorText.length)) {
        const span = makeCharSpan(ch)
        displayElement.appendChild(span)
        spectatorSpans.push(span)
      }
      displayElement.classList.add('has-content')
      spectatorText = text
      return
    }

    // Full rebuild — floor holder changed or unrecognised delta
    displayElement.innerHTML = ''
    spectatorSpans = []
    displayElement.classList.toggle('has-content', text.length > 0)
    for (const ch of text) {
      const span = makeCharSpan(ch)
      displayElement.appendChild(span)
      spectatorSpans.push(span)
    }
    spectatorText = text
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

  // Claim the floor (if not already held) and reset the display to a blank
  // slate ready for input. Called on Enter (desktop) and touchstart (mobile).
  function claimFloorAndStart() {
    if (floorHolder !== uid) {
      floorHolder = uid
      myClaimedAt = Math.max(Date.now(), floorClaimedAt + 1)
      floorClaimedAt = myClaimedAt
      enableInput()
      displayElement.style.color = color
      displayElement.style.fontFamily = font
    }
    inputElement.focus()
    clearAllChars()
    displayElement.innerHTML = ''
    showCursor()
    syncTextareaToChars()
    updateChat({ text: '', color, font, activeUser: uid, claimedAt: myClaimedAt })
  }

  // Keep the hidden textarea focused whenever this user holds the floor.
  // Handles any browser quirk that causes it to lose focus unexpectedly.
  inputElement.addEventListener('blur', () => {
    if (floorHolder === uid) requestAnimationFrame(() => inputElement.focus())
  })

  // Global Enter listener — works without clicking the display
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    claimFloorAndStart()
  })

  listenChat(updateInput)

  inputElement.addEventListener('input', event => {
    // Auto-claim floor on first keystroke if unclaimed
    if (!floorHolder) {
      floorHolder = uid
      myClaimedAt = Math.max(Date.now(), floorClaimedAt + 1)
      floorClaimedAt = myClaimedAt
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
      if (chars.length === 0) {
        displayElement.classList.remove('has-content')
        resetFontSize()
        stopCharChecker()
      }
    }

    syncTextareaToChars()
    broadcastText()
  })

  function updateInput({ text, color: textColor, font: textFont, activeUser, claimedAt = 0 }) {
    if (claimedAt < floorClaimedAt) return  // stale broadcast from a previous floor holder
    floorClaimedAt = claimedAt

    const wasHolder = floorHolder === uid
    const previousHolder = floorHolder
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
      if (floorHolder !== previousHolder) {
        spectatorSpans = []
        spectatorText = ''
        resetFontSize()
      }
      renderStaticDisplay(text)
      adjustFontSize()
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
