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

const MAX_INPUT_LENGTH = 100

// --- Routing ---

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

  // Global Enter listener — works without clicking the input
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (floorHolder !== uid) {
      floorHolder = uid
      enableInput()
      inputElement.focus()
    }
    updateChat({ text: '', color, font, activeUser: uid })
  })

  listenChat(updateInput)

  inputElement.addEventListener('input', event => {
    const target = event.target
    if (target.value.length > MAX_INPUT_LENGTH) {
      target.value = target.value.slice(0, MAX_INPUT_LENGTH)
    }
    updateHeight(target)
    // Claims floor on first edit if unclaimed; broadcasts live text updates
    if (!floorHolder) floorHolder = uid
    if (floorHolder === uid) {
      updateChat({ text: target.value, color, font, activeUser: uid })
    }
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
