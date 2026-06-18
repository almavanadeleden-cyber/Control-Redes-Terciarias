import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDv7iKeaGJgGBndZ9ejwvnb3eAOKaHxdiA",
  authDomain: "control-redes-terciarias.firebaseapp.com",
  projectId: "control-redes-terciarias",
  storageBucket: "control-redes-terciarias.firebasestorage.app",
  messagingSenderId: "419208358758",
  appId: "1:419208358758:web:ec5c2c9c0b77bca904b6a7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };