import { listenChat, updateChat } from './firebase.js'

// Generate or retrieve UID
let uid = localStorage.getItem('uid')
if (!uid) {
  uid = generateUID()
  localStorage.setItem('uid', uid)
}

function generateUID() {
  return Math.random().toString(36).substr(2, 9)
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

console.log('uid:', uid)
console.log('color:', color)

const inputElement = document.getElementById('input')

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

function updateInput(text) {
  inputElement.value = text
  inputElement.style.color = color
  updateHeight(inputElement)
}

function updateHeight(inputElement) {
  inputElement.style.height = 'auto'
  inputElement.style.height = `${inputElement.scrollHeight}px`
}