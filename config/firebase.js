import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    createUserWithEmailAndPassword,
    getAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    query,
    setDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDIM1mBM9AuficthPXlpjwMcNTi5H63PW4",
    authDomain: "proyecto-web-9f7fc.firebaseapp.com",
    projectId: "proyecto-web-9f7fc",
    storageBucket: "proyecto-web-9f7fc.firebasestorage.app",
    messagingSenderId: "325159836538",
    appId: "1:325159836538:web:9907100d419ef41f2494c3",
    measurementId: "G-MJV4XPPJYR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const dbMethods = {
    collection,
    createUserWithEmailAndPassword,
    doc,
    getDoc,
    getDocs,
    onAuthStateChanged,
    query,
    sendPasswordResetEmail,
    setDoc,
    signInWithEmailAndPassword,
    signOut,
    where
};

window.auth = auth;
window.db = db;
window.dbMethods = dbMethods;
window.dispatchEvent(new CustomEvent("firebaseReady"));

export { app, auth, db, dbMethods };
