// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB0ScjwzKahK5Vhlt742LhnRxHnwu-K0pw",
  authDomain: "abhiquiz-12.firebaseapp.com",
  projectId: "abhiquiz-12",
  storageBucket: "abhiquiz-12.firebasestorage.app",
  messagingSenderId: "88063904694",
  appId: "1:88063904694:web:6f0cf1477d70a88fa9cf17",
  measurementId: "G-KTW62W8VT8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);