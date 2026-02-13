// firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCGgdTIOxTUxF4neuFla1Lu1N1z0QpKdbk",
  authDomain: "roadguard-7bce6.firebaseapp.com",
  projectId: "roadguard-7bce6",
  storageBucket: "roadguard-7bce6.appspot.com",
  messagingSenderId: "613438246131",
  appId: "1:613438246131:web:f873b8a44d339a5feb7b86",
  measurementId: "G-6B7R069T3Y",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exports
export const auth = getAuth(app);
export const db = getFirestore(app);