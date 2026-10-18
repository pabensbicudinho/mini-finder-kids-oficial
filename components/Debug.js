// components/Debug.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { listarCriancas, listarRotas } from '../services/firestoreService';

export default function Debug({ onNavigate }) {
  const [usuarios, setUsuarios] = useState([]);
  const [criancas, setCriancas] = useState([]);
  const [rotas, setRotas] = useState([]);

  const carregarDados = async () => {
    try {
      // 1. Usuários do Firebase
      const usersSnapshot = await getDocs(collection(db, "users"));
      const listaUsers = [];
      usersSnapshot.forEach((doc) => {
        listaUsers.push({ id: doc.id, ...doc.data() });
      });
      setUsuarios(listaUsers);

      // 2. Crianças (usa a função do firestoreService)
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        const listaCriancas = await listarCriancas(user.uid);
        setCriancas(listaCriancas || []);

        // 3. Rotas/Perímetros da primeira criança
        if (listaCriancas && listaCriancas.length > 0) {
          const idCrianca = listaCriancas[0].id;
          const listaRotas = await listarRotas(idCrianca);
          setRotas(listaRotas || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados de debug:', error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('inicio')} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1A237E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debug do Banco</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* USUÁRIOS */}
        <Text style={styles.sectionTitle}>👤 Usuários ({usuarios.length})</Text>
        {usuarios.length === 0 ? (
          <Text style={styles.empty}>Nenhum usuário.</Text>
        ) : (
          usuarios.map((u, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardText}>Nome: {u.nome}</Text>
              <Text style={styles.cardText}>Email: {u.email}</Text>
              <Text style={styles.cardText}>Telefone: {u.telefone}</Text>
              <Text style={styles.cardText}>Nascimento: {u.dataNasc}</Text>
            </View>
          ))
        )}

        {/* CRIANÇAS */}
        <Text style={styles.sectionTitle}>👧 Crianças ({criancas.length})</Text>
        {criancas.length === 0 ? (
          <Text style={styles.empty}>Nenhuma criança.</Text>
        ) : (
          criancas.map((c) => (
            <View key={c.id} style={styles.card}>
              <Text style={styles.cardText}>ID: {c.id}</Text>
              <Text style={styles.cardText}>Nome: {c.nome}</Text>
              <Text style={styles.cardText}>Idade: {c.idade}</Text>
              <Text style={styles.cardText}>Dispositivo: {c.dispositivo}</Text>
            </View>
          ))
        )}

        {/* ROTAS / PERÍMETROS */}
        <Text style={styles.sectionTitle}>🛡️ Perímetros Seguros ({rotas.length})</Text>
        {rotas.length === 0 ? (
          <Text style={styles.empty}>Nenhum perímetro cadastrado.</Text>
        ) : (
          rotas.map((r, i) => (
            <View key={i} style={styles.card}>
              <Text style={styles.cardText}>Nome: {r.nome}</Text>
              <Text style={styles.cardText}>Raio: {r.raio}m</Text>
              <Text style={styles.cardText}>Lat: {r.latitudeDestino}</Text>
              <Text style={styles.cardText}>Long: {r.longitudeDestino}</Text>
            </View>
          ))
        )}

        {/* BOTÃO ATUALIZAR */}
        <TouchableOpacity style={styles.refreshButton} onPress={carregarDados}>
          <Ionicons name="refresh" size={20} color="#FFF" />
          <Text style={styles.refreshText}>Atualizar</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#1E3A8A',
    marginTop: 20, marginBottom: 10,
  },
  empty: {
    fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10,
  },
  card: {
    backgroundColor: '#FFF', padding: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  cardText: { fontSize: 13, color: '#333', marginBottom: 2 },
  refreshButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1E3A8A', paddingVertical: 12, borderRadius: 10, marginTop: 20,
  },
  refreshText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
});