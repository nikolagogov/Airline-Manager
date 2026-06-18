// ==================== FIREBASE CONFIG ====================
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    child,
    update
} from 'firebase/database';

// ==================== CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyAVT5KpgL6Fuc3KDYWQzh1RCXaMp6rLi64",
  authDomain: "airport-simulator-2b926.firebaseapp.com",
  databaseURL: "https://airport-simulator-2b926-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "airport-simulator-2b926",
  storageBucket: "airport-simulator-2b926.firebasestorage.app",
  messagingSenderId: "222961390891",
  appId: "1:222961390891:web:78b57c97adad3d0a14e16e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

// ==================== AUTH FUNCTIONS ====================
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        let message = error.message;
        if (error.code === 'auth/user-not-found') message = 'User not found!';
        if (error.code === 'auth/wrong-password') message = 'Wrong password!';
        if (error.code === 'auth/invalid-email') message = 'Invalid email!';
        if (error.code === 'auth/too-many-requests') message = 'Too many attempts. Try again later.';
        return { success: false, error: message };
    }
}

export async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        let message = error.message;
        if (error.code === 'auth/email-already-in-use') message = 'Email already in use!';
        if (error.code === 'auth/weak-password') message = 'Password must be at least 6 characters!';
        if (error.code === 'auth/invalid-email') message = 'Invalid email!';
        return { success: false, error: message };
    }
}

export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user };
    } catch (error) {
        let message = error.message;
        if (error.code === 'auth/popup-closed-by-user') message = 'Login cancelled.';
        if (error.code === 'auth/popup-blocked') message = 'Popup blocked. Please allow popups.';
        return { success: false, error: message };
    }
}

export function logoutUser() {
    return signOut(auth);
}

export function onAuthChange(callback) {
    return onAuthStateChanged(auth, callback);
}

// ==================== CLOUD SAVE ====================
export async function saveGameToCloud(userId, gameData) {
    try {
        await set(ref(database, `users/${userId}/gameState`), gameData);
        return { success: true };
    } catch (error) {
        console.error('Cloud save failed:', error);
        return { success: false, error: error.message };
    }
}

export async function loadGameFromCloud(userId) {
    try {
        const snapshot = await get(child(ref(database), `users/${userId}/gameState`));
        if (snapshot.exists()) {
            return { success: true, data: snapshot.val() };
        }
        return { success: false, error: 'No save found' };
    } catch (error) {
        console.error('Cloud load failed:', error);
        return { success: false, error: error.message };
    }
}

export async function saveToLeaderboard(userId, displayName, gameData) {
    try {
        await update(ref(database, `leaderboard/${userId}`), {
            displayName: displayName || 'Anonymous',
            revenue: gameData.totalRevenue || 0,
            flights: gameData.totalFlights || 0,
            aircrafts: gameData.aircrafts ? gameData.aircrafts.length : 0,
            level: gameData.companyLevel || 1,
            lastUpdate: Date.now()
        });
        return { success: true };
    } catch (error) {
        console.error('Leaderboard save failed:', error);
        return { success: false, error: error.message };
    }
}

export async function loadLeaderboard() {
    try {
        const snapshot = await get(child(ref(database), 'leaderboard'));
        if (snapshot.exists()) {
            const data = snapshot.val();
            const entries = Object.entries(data).map(([id, entry]) => ({
                id,
                ...entry
            }));
            entries.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
            return { success: true, data: entries };
        }
        return { success: true, data: [] };
    } catch (error) {
        console.error('Leaderboard load failed:', error);
        return { success: false, error: error.message };
    }
}

// ==================== AUTH STATE INFO (без DOM) ====================
export function getAuthState(user) {
    return {
        isLoggedIn: !!user,
        email: user?.email || user?.displayName || null,
        uid: user?.uid || null,
        displayName: user?.displayName || null
    };
}