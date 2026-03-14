import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js'
import {
  getDatabase,
  ref,
  get,
  update,
  onValue,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js'

const firebaseConfig = {
  apiKey: 'AIzaSyBXOkqvSNrMGBPRKksYOz4BZa_of9ZFppk',
  authDomain: 'theonelinechat.firebaseapp.com',
  databaseURL: 'https://theonelinechat-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'theonelinechat',
  storageBucket: 'theonelinechat.appspot.com',
  messagingSenderId: '164861860601',
  appId: '1:164861860601:web:0ca922660545d4bf596028',
  measurementId: 'G-9CPWR04SEN'
}

const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
let nodeRef = null

export function setRoom(roomId) {
  nodeRef = ref(database, `rooms/${roomId}`)
}

export async function getTakenFonts(roomId, uid) {
  const snapshot = await get(ref(database, `rooms/${roomId}/users`))
  const users = snapshot.val() || {}
  return Object.entries(users)
    .filter(([id]) => id !== uid)
    .map(([, u]) => u.font)
    .filter(Boolean)
}

export function registerUser(roomId, uid, font, color) {
  update(ref(database, `rooms/${roomId}/users/${uid}`), { font, color })
}

export function listenChat(callback) {
  onValue(nodeRef, (snapshot) => {
    const data = snapshot.val() || {}
    callback({ text: data.text ?? '', color: data.color, font: data.font, activeUser: data.activeUser ?? null })
  })
}

export function updateChat({ text, color, font, activeUser }) {
  update(nodeRef, { text, color, font, activeUser })
}
