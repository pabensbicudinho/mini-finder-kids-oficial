// services/cameraService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const STORAGE_KEY = '@historico_camera_local';
const PASTA_MIDIAS = 'midias';

// ============================================================
// GARANTIR QUE A PASTA EXISTE (apenas mobile)
// ============================================================
const garantirPasta = () => {
  if (Platform.OS === 'web') return null;
  const pasta = new Directory(Paths.document, PASTA_MIDIAS);
  if (!pasta.exists) {
    pasta.create({ intermediates: true });
  }
  return pasta;
};

// ============================================================
// SALVAR MÍDIA (foto ou vídeo)
// ============================================================
export const salvarMidia = async (uriLocal, tipo, duracaoSegundos = 0, criancaId = null) => {
  try {
    const id = `${tipo}-${Date.now()}`;
    let uriFinal = uriLocal;
    let tamanho = 0;

    if (Platform.OS !== 'web') {
      const pasta = garantirPasta();
      const extensao = tipo === 'foto' ? 'jpg' : 'mp4';
      const arquivoTemp = new File(uriLocal);
      const arquivoFinal = new File(pasta, `${id}.${extensao}`);

      // Move o arquivo temporário para a pasta permanente
      arquivoTemp.move(arquivoFinal);
      uriFinal = arquivoFinal.uri;
      tamanho = arquivoFinal.size || 0;
    } else {
      // No web não temos File API nativa — usamos fetch para estimar o tamanho
      try {
        const resposta = await fetch(uriLocal);
        const blob = await resposta.blob();
        tamanho = blob.size;
      } catch {
        tamanho = 0;
      }
    }

    const agora = new Date();
    const novaMidia = {
      id,
      tipo,
      uri: uriFinal,
      tamanho,
      duracaoSegundos,
      data: agora.toLocaleDateString('pt-BR'),
      hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      conectado: true,
      criancaId: criancaId || null,
    };

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    lista.unshift(novaMidia);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));

    return { success: true, midia: novaMidia };
  } catch (error) {
    console.error('Erro ao salvar mídia:', error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// LISTAR MÍDIAS
// ============================================================
export const listarMidias = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Erro ao listar mídias:', error);
    return [];
  }
};

// ============================================================
// DELETAR MÍDIA
// ============================================================
export const deletarMidia = async (id, uri) => {
  try {
    if (Platform.OS !== 'web' && uri) {
      const arquivo = new File(uri);
      if (arquivo.exists) {
        arquivo.delete();
      }
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const lista = raw ? JSON.parse(raw) : [];
    const novaLista = lista.filter((m) => m.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(novaLista));

    return { success: true };
  } catch (error) {
    console.error('Erro ao deletar mídia:', error);
    return { success: false, message: error.message };
  }
};

// ============================================================
// LIMPAR MÍDIAS HIPOTÉTICAS (arquivos que não existem mais)
// ============================================================
export const limparMidiasHipoteticas = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { success: true, removidos: 0 };

    const lista = JSON.parse(raw);
    if (Platform.OS === 'web') return { success: true, removidos: 0 };

    const validos = [];
    for (const midia of lista) {
      try {
        const arquivo = new File(midia.uri);
        if (arquivo.exists) validos.push(midia);
      } catch (e) {
        // arquivo inválido — ignora
      }
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validos));
    return { success: true, removidos: lista.length - validos.length };
  } catch (error) {
    console.error('Erro ao limpar mídias:', error);
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

// ============================================================
// FORMATAR DURAÇÃO
// ============================================================
export const formatarDuracao = (segundos) => {
  if (!segundos) return '00:00';
  const mm = String(Math.floor(segundos / 60)).padStart(2, '0');
  const ss = String(Math.round(segundos % 60)).padStart(2, '0');
  return `${mm}:${ss}`;
};