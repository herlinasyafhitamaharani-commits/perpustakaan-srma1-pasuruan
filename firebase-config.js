
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC54SX9aCimba7V6uVNaFX6slTihlM61Nc",
    authDomain: "perpustakaan-srma-pasuruan.firebaseapp.com",
    projectId: "perpustakaan-srma-pasuruan",
    storageBucket: "perpustakaan-srma-pasuruan.firebasestorage.app",
    messagingSenderId: "89480631754",
    appId: "1:89480631754:web:be0fb2ac72ba4a06e66b33"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);
