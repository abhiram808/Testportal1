// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB0ScjwzKahK5Vhlt742LhnRxHnwu-K0pw",
  authDomain: "abhiquiz-12.firebaseapp.com",
  projectId: "abhiquiz-12",
  storageBucket: "abhiquiz-12.firebasestorage.app",
  messagingSenderId: "88063904694",
  appId: "1:88063904694:web:6f0cf1477d70a88fa9cf17",
  measurementId: "G-KTW62W8VT8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export { signOut };