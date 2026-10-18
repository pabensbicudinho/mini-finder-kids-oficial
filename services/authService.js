import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export const cadastrarUsuario = async (nome, email, telefone, dataNasc, senha) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;
    
    // Salva os dados extra no Firestore
    await setDoc(doc(db, "users", user.uid), {
      nome, email, telefone, dataNasc, role: 'responsavel', criadoEm: new Date()
    });
    
    return { success: true, user };
  } catch (error) {
    console.error("Erro no cadastro:", error);
    return { success: false, message: error.message };
  }
};

export const loginUsuario = async (email, senha) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;
    
    // Busca os dados no Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      return { success: true, user: { id: user.uid, ...userDoc.data() } };
    }
    return { success: false, message: "Dados do usuário não encontrados." };
  } catch (error) {
    console.error("Erro no login:", error);
    return { success: false, message: "E-mail ou senha incorretos." };
  }
};

export const logout = () => signOut(auth);