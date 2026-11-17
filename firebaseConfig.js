// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  getAuth, 
  getReactNativePersistence 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ NOVAS CONFIGURAÇÕES DO PROJETO "primeiro-22c60"
const firebaseConfig = {
  apiKey: "AIzaSyD7JlxFVfm8VrdnLIndN3d4ks8_c5WWOTU",
  authDomain: "primeiro-22c60.firebaseapp.com",
  projectId: "primeiro-22c60",
  storageBucket: "primeiro-22c60.firebasestorage.app",
  messagingSenderId: "819325176504",
  appId: "1:819325176504:web:5c68ca167827bd9114824d",
  measurementId: "G-X4LY1K4J8H"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// 🔑 CONFIGURAÇÃO CONDICIONAL DE AUTENTICAÇÃO
let auth;

if (Platform.OS === 'web') {
  // 🌐 No navegador, usa o getAuth padrão
  auth = getAuth(app);
} else {
  // 📱 No APK (Android/iOS), usa AsyncStorage para persistência
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

// Exporta o banco de dados (Firestore)
export const db = getFirestore(app);

// Exporta o armazenamento de arquivos (Storage)
export const storage = getStorage(app);

// Exporta a autenticação
export { auth };