// components/HistoricoMicrofone.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy'; // 🔑 API legada para evitar erro
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  AudioModule,
  createAudioPlayer,
} from 'expo-audio';
import { listarMidias, deletarMidia } from '../services/firestoreService';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function HistoricoMicrofone({ userData, onNavigate, previousScreen }) {
  const insets = useSafeAreaInsets();
  const [gravacoes, setGravacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [tocandoId, setTocandoId] = useState(null);
  const [gravando, setGravando] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ============================================================
  // CARREGAR HISTÓRICO
  // ============================================================
  const carregarHistorico = useCallback(async () => {
    try {
      setCarregando(true);
      if (!userData?.id) return;

      const lista = await listarMidias(userData.id, 'audio');
      setGravacoes(lista || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setCarregando(false);
    }
  }, [userData]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // ============================================================
  // PERMISSÃO
  // ============================================================
  const pedirPermissao = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      return status.granted;
    } catch (error) {
      console.error('Erro ao pedir permissão:', error);
      return false;
    }
  };

  // ============================================================
  // GRAVAR E FAZER UPLOAD (BASE64)
  // ============================================================
  const handleGravarTeste = async () => {
    const permissao = await pedirPermissao();
    if (!permissao) {
      Alert.alert('Permissão negada', 'Habilite o microfone nas configurações.');
      return;
    }

    try {
      setGravando(true);

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      Alert.alert('Gravando...', 'Fale algo por 5 segundos.');

      setTimeout(async () => {
        try {
          await audioRecorder.stop();
          const uriLocal = audioRecorder.uri;

          setGravando(false);

          if (!uriLocal) {
            Alert.alert('Erro', 'Não foi possível obter o arquivo de áudio.');
            return;
          }

          Alert.alert('Enviando...', 'Salvando o áudio no banco (Base64).');

          // 🔑 Conversão para Base64 usando a API legada
          const base64 = await FileSystem.readAsStringAsync(uriLocal, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const nomeArquivo = `audio-${Date.now()}.m4a`;

          // 🔑 Salva direto no Firestore (sem Firebase Storage)
          await addDoc(collection(db, "criancas", userData.id, "midias"), {
            tipo: 'audio',
            base64Data: base64,
            storagePath: nomeArquivo,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
            duracao: '00:05',
            tamanho: base64.length,
            conectado: true,
            criadoEm: serverTimestamp(),
          });

          await carregarHistorico();
          Alert.alert('Sucesso', 'Áudio salvo no banco de dados!');
        } catch (error) {
          console.error('Erro no upload:', error);
          setGravando(false);
          Alert.alert('Erro', 'Falha ao salvar no banco.');
        }
      }, 5000);
    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      setGravando(false);
      Alert.alert('Erro', 'Não foi possível iniciar a gravação.');
    }
  };

  // ============================================================
  // TOCAR / PARAR
  // ============================================================
  const handleTocar = async (item) => {
    if (tocandoId === item.id) {
      setTocandoId(null);
      return;
    }

    try {
      // 🔑 Toca o áudio a partir do Base64
      const dataUri = `data:audio/m4a;base64,${item.base64Data}`;
      const player = createAudioPlayer(dataUri);
      player.play();
      setTocandoId(item.id);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível reproduzir o áudio.');
    }
  };

  // ============================================================
  // DELETAR
  // ============================================================
  const handleDeletar = (item) => {
    Alert.alert(
      'Excluir gravação',
      `Excluir o áudio de ${item.data} às ${item.hora}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deletarMidia(userData.id, item.id);
              if (res.success) {
                setGravacoes((prev) => prev.filter((a) => a.id !== item.id));
              }
            } catch (error) {
              Alert.alert('Erro', 'Falha ao excluir.');
            }
          },
        },
      ]
    );
  };

  // ============================================================
  // CARD
  // ============================================================
  const renderCard = (item) => {
    const estaTocando = tocandoId === item.id;

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardDate}>Dia {item.data}</Text>
          <TouchableOpacity onPress={() => handleDeletar(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>

        <Text style={styles.cardInfo}>
          {item.hora} • {item.duracao} • {item.tamanho ? `${Math.round(item.tamanho / 1024)} KB` : 'Nuvem'}
        </Text>

        {item.motivo ? (
          <Text style={styles.cardMotivo} numberOfLines={2}>{item.motivo}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.playButton, estaTocando && styles.playButtonActive]}
            onPress={() => handleTocar(item)}
            activeOpacity={0.7}
          >
            <Ionicons name={estaTocando ? 'pause' : 'play'} size={18} color="#FFF" />
            <Text style={styles.playButtonText}>{estaTocando ? 'Parar' : 'Ouvir'}</Text>
          </TouchableOpacity>

          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: item.conectado ? '#10B981' : '#DC2626' }]} />
            <Text style={styles.cardStatus}>{item.conectado ? 'Nuvem' : 'Offline'}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ============================================================
  // HEADER
  // ============================================================
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => onNavigate(previousScreen || 'mapa', userData)} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color="#1A237E" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Microfone histórico</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3A8A" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.recButton, gravando && styles.recButtonActive]}
          onPress={handleGravarTeste}
          disabled={gravando}
          activeOpacity={0.8}
        >
          <Ionicons name={gravando ? 'radio-button-on' : 'mic'} size={20} color="#FFF" />
          <Text style={styles.recButtonText}>{gravando ? 'Gravando...' : 'Gravar novo áudio (5s)'}</Text>
        </TouchableOpacity>

        {gravacoes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mic-off-outline" size={50} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Nenhuma gravação</Text>
            <Text style={styles.emptySubtitle}>Toque em "Gravar novo áudio" para testar.</Text>
          </View>
        ) : (
          gravacoes.map((item) => renderCard(item))
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('alerta')}>
          <Ionicons name="notifications-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>Alertas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('inicio')}>
          <Ionicons name="home" size={22} color="#1E3A8A" />
          <Text style={styles.navTextActive}>Início</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('perfil')}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  headerSpacer: { width: 40 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E3A8A', paddingVertical: 14, borderRadius: 12, marginBottom: 20 },
  recButtonActive: { backgroundColor: '#DC2626' },
  recButtonText: { color: '#FFF', fontWeight: '700', marginLeft: 8, fontSize: 14 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardDate: { fontSize: 15, fontWeight: '700', color: '#1E3A8A' },
  cardInfo: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  cardMotivo: { fontSize: 12, color: '#1E3A8A', marginBottom: 10, fontStyle: 'italic', lineHeight: 16 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  playButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E3A8A', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  playButtonActive: { backgroundColor: '#DC2626' },
  playButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  cardStatus: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A8A', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', elevation: 10 },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  navText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  navTextActive: { fontSize: 11, color: '#1E3A8A', fontWeight: '700', marginTop: 2 },
});