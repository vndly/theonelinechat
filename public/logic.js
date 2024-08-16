import { listenChat, updateChat } from './firebase.js'

const inputElement = document.getElementById('input')
inputElement.addEventListener('keyup', function (event) {
  updateChat(inputElement.value)
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
  updateHeight(inputElement)
}

function updateHeight(inputElement) {
  inputElement.style.height = 'auto'
  inputElement.style.height = `${inputElement.scrollHeight}px`
}