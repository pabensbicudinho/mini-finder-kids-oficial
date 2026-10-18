// services/firestoreService.js
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc,
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// ==========================================
// --- CRIANÇAS ---
// ==========================================
export const salvarCrianca = async (crianca) => {
  try {
    const docRef = await addDoc(collection(db, "criancas"), {
      ...crianca,
      criadoEm: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Erro ao salvar criança:", error);
    return { success: false, message: error.message };
  }
};

export const listarCriancas = async (responsavelUid) => {
  try {
    const q = query(collection(db, "criancas"), where("responsavelUid", "==", responsavelUid));
    const querySnapshot = await getDocs(q);
    const criancas = [];
    querySnapshot.forEach((doc) => {
      criancas.push({ id: doc.id, ...doc.data() });
    });
    return criancas;
  } catch (error) {
    console.error("Erro ao listar crianças:", error);
    return [];
  }
};

// ==========================================
// --- LOCALIZAÇÕES ---
// ==========================================
export const salvarLocalizacao = async (criancaId, latitude, longitude) => {
  try {
    const locRef = collection(db, "criancas", criancaId, "localizacoes");
    await addDoc(locRef, { latitude, longitude, timestamp: serverTimestamp() });
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const listarLocalizacoes = async (criancaId) => {
  try {
    const locRef = collection(db, "criancas", criancaId, "localizacoes");
    const q = query(locRef, orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    const localizacoes = [];
    querySnapshot.forEach((doc) => {
      localizacoes.push({ id: doc.id, ...doc.data() });
    });
    return localizacoes;
  } catch (error) {
    console.error("Erro ao listar localizações:", error);
    return [];
  }
};

// ==========================================
// --- ROTAS / PERÍMETROS ---
// ==========================================
export const salvarRota = async (criancaId, rota) => {
  try {
    const rotaRef = collection(db, "criancas", criancaId, "rotas");
    const docRef = await addDoc(rotaRef, { ...rota, criadoEm: serverTimestamp() });
    return { success: true, id: docRef.id };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const listarRotas = async (criancaId) => {
  try {
    const rotaRef = collection(db, "criancas", criancaId, "rotas");
    const q = query(rotaRef, orderBy("criadoEm", "desc"));
    const querySnapshot = await getDocs(q);
    const rotas = [];
    querySnapshot.forEach((doc) => {
      rotas.push({ id: doc.id, ...doc.data() });
    });
    return rotas;
  } catch (error) {
    console.error("Erro ao listar rotas:", error);
    return [];
  }
};

export const deletarRota = async (criancaId, rotaId) => {
  try {
    await deleteDoc(doc(db, "criancas", criancaId, "rotas", rotaId));
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar rota:", error);
    return { success: false, message: error.message };
  }
};

// ==========================================
// --- MÍDIAS (ÁUDIOS, FOTOS, VÍDEOS) ---
// ==========================================
export const listarMidias = async (criancaId, tipo = null) => {
  try {
    const midiaRef = collection(db, "criancas", criancaId, "midias");
    let q = query(midiaRef, orderBy("criadoEm", "desc"));
    
    if (tipo) {
      q = query(midiaRef, where("tipo", "==", tipo), orderBy("criadoEm", "desc"));
    }

    const querySnapshot = await getDocs(q);
    const midias = [];
    querySnapshot.forEach((doc) => {
      midias.push({ id: doc.id, ...doc.data() });
    });
    return midias;
  } catch (error) {
    console.error(`Erro ao listar mídias (${tipo}):`, error);
    return [];
  }
};

export const deletarMidia = async (criancaId, midiaId) => {
  try {
    await deleteDoc(doc(db, "criancas", criancaId, "midias", midiaId));
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar mídia:", error);
    return { success: false, message: error.message };
  }
};