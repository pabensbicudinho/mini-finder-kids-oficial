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

// Cole aqui as configurações que o Firebase te passou
const firebaseConfig = {
  apiKey: "AIzaSyBqRrIWhgSIWy_N7WCklObX61-ElEJAoMI",
  authDomain: "teste-2dd65.firebaseapp.com",
  projectId: "teste-2dd65",
  storageBucket: "teste-2dd65.firebasestorage.app",
  messagingSenderId: "1084510629607",
  appId: "1:1084510629607:web:e8f90b814f1f32dc833c42",
  measurementId: "G-57C9Y2CKDS"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// 🔑 CONFIGURAÇÃO CONDICIONAL DE AUTENTICAÇÃO
let auth;

if (Platform.OS === 'web') {
  // 🌐 No navegador, usa o getAuth padrão (persistência local do browser)
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