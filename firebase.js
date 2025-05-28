import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';       

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAbWTuCcJN6uIS6kjmu76AnArudB7TGly4",
  authDomain: "fyp-app-78895.firebaseapp.com",
  databaseURL: "https://fyp-app-78895-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fyp-app-78895",
  storageBucket: "fyp-app-78895.appspot.com",
  messagingSenderId: "678027422119",
  appId: "1:678027422119:web:754275d39b3e78c1d56e82"
};

// Ensure Firebase is initialized only once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
const db = getFirestore(app);
export { app,auth,db };
