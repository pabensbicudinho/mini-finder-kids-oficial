import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { salvarMidia } from '../services/cameraService';

export default function CameraCapture({ userData, onNavigate }) {
  const [permissao, requestPermissao] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [modo, setModo] = useState('foto');
  const [capturando, setCapturando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);

  const cameraRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!permissao) return;
    if (!permissao.granted) requestPermissao();
  }, [permissao]);

  useEffect(() => {
    if (gravando) {
      setTempoGravacao(0);
      timerRef.current = setInterval(() => {
        setTempoGravacao((t) => {
          if (t + 1 >= 15) {
            if (cameraRef.current) cameraRef.current.stopRecording();
            return 15;
          }
          return t + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gravando]);

  const handleCapturarFoto = async () => {
    if (!cameraRef.current || capturando) return;
    try {
      setCapturando(true);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: false });
      const res = await salvarMidia(photo.uri, 'foto', 0, userData?.id);

      if (res.success) {
        Alert.alert('✅ Foto salva!', 'Adicionada ao histórico local.', [
          { text: 'Ver histórico', onPress: () => onNavigate('historicoCamera', userData) },
          { text: 'Tirar outra', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Erro', 'Não foi possível salvar.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setCapturando(false);
    }
  };

  const iniciarGravacao = async () => {
    if (!cameraRef.current || gravando) return;
    try {
      setGravando(true);
      const video = await cameraRef.current.recordAsync({ maxDuration: 15 });
      if (video?.uri) {
        const res = await salvarMidia(video.uri, 'video', tempoGravacao, userData?.id);
        if (res.success) Alert.alert('✅ Vídeo salvo!', 'Adicionado ao histórico local.');
        else Alert.alert('Erro', 'Não foi possível salvar.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível gravar.');
    } finally {
      setGravando(false);
    }
  };

  const handleBotaoPrincipal = () => {
    if (modo === 'foto') handleCapturarFoto();
    else {
      if (gravando && cameraRef.current) cameraRef.current.stopRecording();
      else iniciarGravacao();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('historicoCamera', userData)}>
          <Ionicons name="chevron-back" size={28} color="#1A237E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Câmera</Text>
        <TouchableOpacity
          onPress={() => setModo(modo === 'foto' ? 'video' : 'foto')}
          style={styles.modeButton}
        >
          <Ionicons
            name={modo === 'foto' ? 'videocam-outline' : 'camera-outline'}
            size={24}
            color="#1A237E"
          />
        </TouchableOpacity>
      </View>

      {permissao?.granted ? (
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode={modo === 'video' ? 'video' : 'picture'}
          />
        </View>
      ) : (
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={60} color="#9CA3AF" />
          <Text style={styles.permissionText}>Permissão de câmera necessária</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermissao}>
            <Text style={styles.permissionButtonText}>Permitir câmera</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.flipButton} onPress={() => setFacing(facing === 'back' ? 'front' : 'back')}>
          <Ionicons name="camera-reverse-outline" size={28} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.captureButton} onPress={handleBotaoPrincipal}>
          <View
            style={[
              styles.captureInner,
              gravando && { backgroundColor: '#DC2626', borderRadius: 8 },
              modo === 'video' && !gravando && { backgroundColor: '#DC2626' },
            ]}
          />
        </TouchableOpacity>

        <View style={styles.flipButton} />
      </View>

      {gravando && (
        <View style={styles.recordingBadge}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Gravando {tempoGravacao}s</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#FFF',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  modeButton: { padding: 4 },

  cameraContainer: { flex: 1 },
  camera: { flex: 1 },

  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    padding: 30,
  },
  permissionText: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 15,
    textAlign: 'center',
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: { color: '#FFF', fontWeight: '700' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 30,
    backgroundColor: '#000',
  },
  flipButton: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center' },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFF' },

  recordingBadge: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
    marginRight: 8,
  },
  recordingText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
});