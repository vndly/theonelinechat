import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js'
import {
  getDatabase,
  ref,
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
const nodeRef = ref(database, 'test')

export function listenChat(callback) {
  onValue(nodeRef, (snapshot) => {
    callback(snapshot.val().text)
  })
}

export function updateChat(text) {
  update(nodeRef, { text: text })
}