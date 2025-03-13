// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAqtFhN-5DzgU-u78LBZ5XLqdYfFtoua74",
  authDomain: "xaicloud.firebaseapp.com",
  projectId: "xaicloud",
  storageBucket: "xaicloud.firebasestorage.app",
  messagingSenderId: "226624316625",
  appId: "1:226624316625:web:4921228d5d8c5abe0911f0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth services
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
