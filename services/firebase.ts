import { initializeApp } from "firebase/app";
// Use namespace import and cast to any to bypass potential type resolution issues with firebase/auth exports in some environments
import * as firebaseAuth from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from "firebase/firestore";

// Extract Auth functions safely
const { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } = firebaseAuth as any;

// ------------------------------------------------------------------
// TODO: REPLACE THIS CONFIG WITH YOUR OWN FROM FIREBASE CONSOLE
// ------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCcMKGtLRSxtxYCyx6ByycLw9XnxYjYleM",
  authDomain: "rxbot-adb43.firebaseapp.com",
  projectId: "rxbot-adb43",
  storageBucket: "rxbot-adb43.firebasestorage.app",
  messagingSenderId: "410537880832",
  appId: "1:410537880832:web:6eb4cec121cba1fdc957e5"
};

// Initialize Firebase
let auth: any;
let db: any;

try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.warn("Firebase config is missing or invalid. Auth/DB will not work until configured in services/firebase.ts");
}

// ------------------------------------------------------------------
// FIRESTORE HISTORY FUNCTIONS
// ------------------------------------------------------------------

export const saveSearchToHistory = async (userId: string, text: string) => {
  if (!db || !userId || !text.trim()) return;
  
  try {
    const historyRef = collection(db, "users", userId, "searchHistory");
    await addDoc(historyRef, {
      text: text.trim(),
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.error("Error saving search history:", e);
  }
};

export const getSearchHistory = async (userId: string): Promise<string[]> => {
  if (!db || !userId) return [];
  
  try {
    const historyRef = collection(db, "users", userId, "searchHistory");
    // Get more than 10 initially to account for duplicates we might filter out
    const q = query(historyRef, orderBy("timestamp", "desc"), limit(30));
    const snapshot = await getDocs(q);
    
    const searches: string[] = snapshot.docs.map(doc => doc.data().text as string);
    // Remove duplicates and limit to top 10
    // Explicitly type Array.from to ensure correct return type
    return Array.from<string>(new Set(searches)).slice(0, 10);
  } catch (e) {
    console.error("Error fetching search history:", e);
    return [];
  }
};

export { auth, db, signInWithEmailAndPassword, signOut, onAuthStateChanged };