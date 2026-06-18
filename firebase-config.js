// Configuración Modular de Firebase v10+ mediante CDN nativo
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// REEMPLAZA ESTE OBJETO CON LAS CREDENCIALES DE TU PROPIO PROYECTO EN FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyDv7iKeaGJgGBndZ9ejwvnb3eAOKaHxdiA",
  authDomain: "control-redes-terciarias.firebaseapp.com",
  projectId: "control-redes-terciarias",
  storageBucket: "control-redes-terciarias.firebasestorage.app",
  messagingSenderId: "419208358758",
  appId: "1:419208358758:web:ec5c2c9c0b77bca904b6a7"
};

// Inicialización de instancias de servicios
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Exportación para su consumo en app.js
export { auth, db };