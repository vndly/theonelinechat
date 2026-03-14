import { listenChat, updateChat, setRoom } from './firebase.js'

// --- Identity ---

let uid = localStorage.getItem('uid')
if (!uid) {
  uid = Math.random().toString(36).substr(2, 9)
  localStorage.setItem('uid', uid)
}

let color = localStorage.getItem('color')
if (!color) {
  color = generateRandomColorWithoutBlue()
  localStorage.setItem('color', color)
}

function generateRandomColorWithoutBlue() {
  let color
  do {
    color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
  } while (color.includes('00') || color.includes('ff'))
  return color
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

const roomId = window.location.pathname.slice(1)
const inputElement = document.getElementById('input')
const hintElement = document.getElementById('hint')
const notificationElement = document.getElementById('notification')

if (roomId) {
  initRoom(roomId)
} else {
  initHomepage()
}

// --- Homepage mode ---

function initHomepage() {
  inputElement.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const value = inputElement.value.trim()
      if (value) {
        window.location.href = '/' + value
      } else {
        createRoom()
      }
    }
  })
}

async function createRoom() {
  const id = generateRoomId()
  try {
    await navigator.clipboard.writeText(id)
  } catch (e) {
    // clipboard unavailable (e.g. non-secure context), carry on
  }
  showNotification(`${id} · copied to clipboard`)
  setTimeout(() => { window.location.href = '/' + id }, 1500)
}

function showNotification(message) {
  notificationElement.textContent = message
  notificationElement.classList.add('visible')
}

// --- Room mode ---

function initRoom(roomId) {
  setRoom(roomId)
  hintElement.classList.add('hidden')

  inputElement.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      updateChat('')
    } else {
      inputElement.addEventListener('keyup', function (event) {
        updateChat(inputElement.value)
      })
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
}

function updateInput(text) {
  inputElement.value = text
  inputElement.style.color = color
  updateHeight(inputElement)
}

function updateHeight(el) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}
