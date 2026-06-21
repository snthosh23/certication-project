const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDGyp509lnsOwRE1ybKkJ_hq0DYdUsIhK4",
  authDomain: "certication-67a9b.firebaseapp.com",
  projectId: "certication-67a9b",
  storageBucket: "certication-67a9b.firebasestorage.app",
  messagingSenderId: "761536560479",
  appId: "1:761536560479:web:01aec9a7aacb35d2734aea",
  measurementId: "G-JNG8Y2ZQD3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { app, db };
