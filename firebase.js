import {

  initializeApp

} from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import {

  getAuth,

  GoogleAuthProvider,

  signInWithPopup,

  signOut,

  onAuthStateChanged

} from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";


import {

  getFirestore,

  doc,

  setDoc,

  getDoc,

  collection,

  addDoc,

  getDocs,

  deleteDoc

} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyCH4ObtHeBZcmjAum48eCKmPnpvYRfRva0",
  authDomain: "astro-explorer-cdd6b.firebaseapp.com",
  projectId: "astro-explorer-cdd6b",
  storageBucket: "astro-explorer-cdd6b.firebasestorage.app",
  messagingSenderId: "188759192348",
  appId: "1:188759192348:web:7a3dc28405ad93220180d9",
  measurementId: "G-9747XL0FQQ"
};


const app =
  initializeApp(
    firebaseConfig
  );

  console.log("🔥 APP CREATED");

  

const auth =
  getAuth(app);

const provider =
  new GoogleAuthProvider();

const db =
  getFirestore(app);

  let currentUser =
  null;


window.auth =
  auth;

window.provider =
  provider;

window.db =
  db;

window.signInWithPopup =
  signInWithPopup;

window.signOut =
  signOut;

window.onAuthStateChanged =
  onAuthStateChanged;

window.setDoc =
  setDoc;

window.getDoc =
  getDoc;

window.doc =
  doc;

window.collection =
  collection;

window.addDoc =
  addDoc;

window.getDocs =
  getDocs;

window.deleteDoc = deleteDoc;
  window.currentUser = null;

  

window.saveChatMessage =
async function(sender, text) {

  if (!window.currentUser)
    return;

  try {

    const chatRef = doc(
      db,
      "users",
      window.currentUser.uid
    );

    const snap =
      await getDoc(chatRef);

    let oldChats = [];

    if (snap.exists()) {

      oldChats =
        snap.data().chatHistory || [];
    }

    oldChats.push({

      sender,
      text,

      time:
        new Date().toISOString()
    });

    await setDoc(chatRef, {

      chatHistory: oldChats

    }, { merge: true });

  }

  catch(err) {

    console.log(err);
  }
};


window.loadChatHistory =
async function() {

  if (!window.currentUser)
    return;

  try {

    const chatRef = doc(
      db,
      "users",
      window.currentUser.uid
    );

    const snap =
      await getDoc(chatRef);

    if (!snap.exists())
      return;

    const chats =
      snap.data().chatHistory || [];

    chats.forEach(chat => {

      addAIMessage(
        chat.text,
        chat.sender
      );
    });

  }

  catch(err) {

    console.log(err);
  }
};