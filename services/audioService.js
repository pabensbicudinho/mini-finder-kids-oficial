// services/audioService.js
import { Platform } from 'react-native';
import { AudioModule, setAudioModeAsync, AudioRecorder, RecordingPresets, createAudioPlayer } from 'expo-audio';

// ============================================================
// PERMISSÃO
// ============================================================
export const pedirPermissaoMicrofone = async () => {
  try {
    if (Platform.OS === 'web') {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    }

    const status = await AudioModule.requestRecordingPermissionsAsync();
    return status.granted;
  } catch (error) {
    console.error('Erro ao pedir permissão:', error);
    return false;
  }
};

// ============================================================
// INICIAR GRAVAÇÃO
// ============================================================
let recorderInstance = null;

export const iniciarGravacao = async () => {
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    // Cria o gravador usando a API oficial do expo-audio
    const recorder = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();

    recorderInstance = recorder;
    return { success: true, recording: recorder };
  } catch (error) {
    console.error('Erro ao iniciar gravação:', error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// PARAR GRAVAÇÃO
// ============================================================
export const pararGravacao = async (recorder) => {
  try {
    const rec = recorder || recorderInstance;
    if (!rec) throw new Error('Nenhuma gravação ativa');

    await rec.stop();
    
    // No expo-audio, a URI final fica em rec.uri
    const uriFinal = rec.uri; 
    
    // Calcula a duração aproximada
    const duracaoSegundos = Math.round(rec.currentTime || 0);
    const mm = String(Math.floor(duracaoSegundos / 60)).padStart(2, '0');
    const ss = String(duracaoSegundos % 60).padStart(2, '0');

    const agora = new Date();
    const novoAudio = {
      id: `audio-${Date.now()}`,
      data: agora.toLocaleDateString('pt-BR'),
      hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      duracao: `${mm}:${ss}`,
      uri: uriFinal,
    };

    recorderInstance = null;
    return { success: true, audio: novoAudio };
  } catch (error) {
    console.error('Erro ao parar gravação:', error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// REPRODUZIR
// ============================================================
let currentPlayer = null;

export const reproduzirAudio = async (uri) => {
  try {
    if (!uri) return { success: false, message: 'URI inválida' };

    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });

    // Cria o player e toca
    const player = createAudioPlayer(uri);
    player.play();

    currentPlayer = player;
    return { success: true, player };
  } catch (error) {
    console.error('Erro ao reproduzir:', error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// PARAR REPRODUÇÃO
// ============================================================
export const pararReproducao = async () => {
  try {
    if (currentPlayer) {
      currentPlayer.pause();
      if (currentPlayer.remove) currentPlayer.remove();
      currentPlayer = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// ============================================================
// FORMATAR TAMANHO
// ============================================================
export const formatarTamanho = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};