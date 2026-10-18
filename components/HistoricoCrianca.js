import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Alert, AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { listarLocalizacoes, listarRotas } from '../services/firestoreService';
import { coordenadasParaEndereco } from '../services/cepService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';


AsyncStorage.removeItem('@cache_enderecos_v2');


const TELA_VOLTAR = 'mapa';
const CACHE_VERSION = 'v2';
const CACHE_KEY = `@cache_enderecos_${CACHE_VERSION}`;
const INTERVALO_ATUALIZACAO = 180000; // 3 minutos

export default function HistoricoCrianca({ userData, onNavigate, previousScreen }) {
  const insets = useSafeAreaInsets();
  const [localizacoes, setLocalizacoes] = useState([]);
  const [rota, setRota] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState('hoje');

  const webMapRef = useRef(null);
  const webPolylineRef = useRef(null);
  const webMapContainerRef = useRef(null);

  const [enderecos, setEnderecos] = useState({});
  const buscandoRef = useRef(new Set());

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================
  const handleVoltar = () => onNavigate(TELA_VOLTAR, userData);

  const handleLimparHistorico = () => {
    Alert.alert('Apagar histórico', 'Isso apagará TODAS as localizações da nuvem. Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            const locRef = collection(db, "criancas", userData.id, "localizacoes");
            const locSnap = await getDocs(locRef);
            for (const d of locSnap.docs) {
              await deleteDoc(doc(db, "criancas", userData.id, "localizacoes", d.id));
            }

            await AsyncStorage.removeItem(CACHE_KEY);
            setLocalizacoes([]);
            setEnderecos({});
            Alert.alert('Sucesso', 'Histórico apagado!');
          } catch (error) {
            Alert.alert('Erro', 'Não foi possível apagar.');
          }
        },
      },
    ]);
  };

  const filtrar3Minutos = (locs) => {
    const locsOrdenadas = (locs || []).sort((a, b) => {
      const dataA = new Date(a.timestamp?.toDate() || a.data_hora);
      const dataB = new Date(b.timestamp?.toDate() || b.data_hora);
      return dataB - dataA;
    });
    const locsFiltradas = [];
    let ultimaAceita = null;
    for (const loc of locsOrdenadas) {
      const dataAtual = new Date(loc.timestamp?.toDate() || loc.data_hora);
      if (!ultimaAceita || (ultimaAceita - dataAtual) >= INTERVALO_ATUALIZACAO) {
        locsFiltradas.push(loc);
        ultimaAceita = dataAtual;
      }
    }
    return locsFiltradas;
  };

  // ============================================================
  // CARREGAMENTO DE DADOS
  // ============================================================
  useEffect(() => {
    const carregarCache = async () => {
      const cache = await AsyncStorage.getItem(CACHE_KEY);
      if (cache) setEnderecos(JSON.parse(cache));
    };
    carregarCache();
  }, []);

  useEffect(() => {
    if (Object.keys(enderecos).length > 0) AsyncStorage.setItem(CACHE_KEY, JSON.stringify(enderecos));
  }, [enderecos]);

  const carregarDados = async () => {
    if (!userData?.id) return;
    try {
      const [locs, rotas] = await Promise.all([
        listarLocalizacoes(userData.id),
        listarRotas(userData.id),
      ]);
      const locsFiltradas = filtrar3Minutos(locs || []);
      setLocalizacoes(locsFiltradas);
      if (rotas && rotas.length > 0) setRota(rotas[0]);
    } catch (error) {
      console.error('Erro ao carregar:', error);
    }
  };

  useEffect(() => {
    const inicial = async () => { setCarregando(true); await carregarDados(); setCarregando(false); };
    inicial();
  }, [userData]);

  useEffect(() => {
    const interval = setInterval(() => carregarDados(), INTERVALO_ATUALIZACAO);
    return () => clearInterval(interval);
  }, [userData]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') carregarDados(); });
    return () => sub.remove();
  }, [userData]);

  // ============================================================
  // BUSCAR ENDEREÇOS (Reverse Geocoding)
  // ============================================================
  useEffect(() => {
    let ativo = true;
    const buscarEnderecos = async () => {
      const novos = { ...enderecos };
      for (const loc of localizacoes) {
        if (!ativo) return;
        const chave = `${loc.latitude},${loc.longitude}`;
        if (novos[chave] !== undefined || buscandoRef.current.has(chave)) continue;
        
        buscandoRef.current.add(chave);
        try {
          const res = await coordenadasParaEndereco(loc.latitude, loc.longitude);
          novos[chave] = res.success ? res.endereco : null;
          setEnderecos({ ...novos });
          await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
          novos[chave] = null;
          setEnderecos({ ...novos });
        } finally {
          buscandoRef.current.delete(chave);
        }
      }
    };
    if (localizacoes.length > 0) buscarEnderecos();
    return () => { ativo = false; };
  }, [localizacoes]);

  // ============================================================
  // FILTROS E FORMATAÇÃO
  // ============================================================
  const filtrarPorPeriodo = (locs) => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
    const seteDias = new Date(hoje); seteDias.setDate(seteDias.getDate() - 7);
    return locs.filter(loc => {
      const d = new Date(loc.timestamp?.toDate() || loc.data_hora);
      if (filtro === 'hoje') return d >= hoje;
      if (filtro === 'ontem') return d >= ontem && d < hoje;
      if (filtro === '7dias') return d >= seteDias;
      return true;
    });
  };

  const localizacoesFiltradas = filtrarPorPeriodo(localizacoes);

  const formatarHora = (loc) => {
    const data = new Date(loc.timestamp?.toDate() || loc.data_hora);
    return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
  };

  const getEndereco = (loc) => enderecos[`${loc.latitude},${loc.longitude}`];

  const normalizarEndereco = (end) => {
    if (!end) return null;
    return {
      logradouro: end.logradouro || end.road || '',
      numero: end.numero || '',
      bairro: end.bairro || end.suburb || '',
      cidade: end.cidade || end.city || '',
      estado: end.estado || end.state || '',
      cep: end.cep || '',
    };
  };

  // ============================================================
  // MAPA NATIVO E WEB (CORRIGIDO COM MARCADORES)
  // ============================================================
  const gerarHTML = (coords, rotaAtual) => {
    if (!coords || coords.length === 0) return `<html><body>Sem localizações</body></html>`;
    const ultima = coords[0];
    const pontos = coords.map((l) => [l.latitude, l.longitude]);
    const rotaStr = rotaAtual ? `L.circle([${rotaAtual.latitudeDestino}, ${rotaAtual.longitudeDestino}], { color: '#1E3A8A', radius: ${rotaAtual.raio || 500} }).addTo(map);` : '';

    return `
      <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; }</style>
      </head><body><div id="map"></div><script>
        var map = L.map('map', { zoomControl: false }).setView([${ultima.latitude}, ${ultima.longitude}], 14);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        ${rotaStr}
        
        var pontos = ${JSON.stringify(pontos)};
        var polyline = L.polyline(pontos, { color: '#1E3A8A', weight: 4 }).addTo(map);
        
        // Marcadores de início e fim
        L.circleMarker(pontos[0], { radius: 8, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }).addTo(map).bindPopup('Início');
        L.circleMarker(pontos[pontos.length - 1], { radius: 8, color: '#DC2626', fillColor: '#DC2626', fillOpacity: 1 }).addTo(map).bindPopup('Fim');
        
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      </script></body></html>
    `;
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !localizacoesFiltradas.length || !webMapContainerRef.current) return;
    let ativo = true;

    const iniciarMapaWeb = async () => {
      try {
        const L = await import('leaflet');
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }
        if (!ativo) return;

        const pontos = localizacoesFiltradas.map((l) => [l.latitude, l.longitude]);

        if (!webMapRef.current) {
          webMapRef.current = L.map(webMapContainerRef.current, { zoomControl: false }).setView(pontos[0], 14);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(webMapRef.current);
          
          if (rota) {
            L.circle([rota.latitudeDestino, rota.longitudeDestino], { color: '#1E3A8A', radius: rota.raio || 500 }).addTo(webMapRef.current);
          }
          
          webPolylineRef.current = L.polyline(pontos, { color: '#1E3A8A', weight: 4 }).addTo(webMapRef.current);
          
          // Marcadores de início e fim
          L.circleMarker(pontos[0], { radius: 8, color: '#10B981', fillColor: '#10B981', fillOpacity: 1 }).addTo(webMapRef.current).bindPopup('Início');
          L.circleMarker(pontos[pontos.length - 1], { radius: 8, color: '#DC2626', fillColor: '#DC2626', fillOpacity: 1 }).addTo(webMapRef.current).bindPopup('Fim');
          
          webMapRef.current.fitBounds(webPolylineRef.current.getBounds(), { padding: [20, 20] });
        }
      } catch (error) { console.error('Erro mapa Web:', error); }
    };
    iniciarMapaWeb();
    return () => { ativo = false; };
  }, [localizacoesFiltradas, rota]);

  useEffect(() => {
    return () => { if (webMapRef.current) { webMapRef.current.remove(); webMapRef.current = null; } };
  }, []);

  // ============================================================
  // RENDERS
  // ============================================================
  const renderMapa = () => {
    if (carregando) {
      return <View style={styles.mapPlaceholder}><ActivityIndicator size="large" color="#1E3A8A" /><Text style={styles.mapPlaceholderText}>Carregando mapa...</Text></View>;
    }
    if (!localizacoesFiltradas.length) {
      return <View style={styles.mapPlaceholder}><Ionicons name="map-outline" size={40} color="#9CA3AF" /><Text style={styles.mapPlaceholderText}>Nenhuma localização no período</Text></View>;
    }
    if (Platform.OS !== 'web') {
      return <WebView style={styles.map} originWhitelist={['*']} source={{ html: gerarHTML(localizacoesFiltradas, rota) }} javaScriptEnabled domStorageEnabled startInLoadingState />;
    }
    return <View ref={webMapContainerRef} style={styles.map} />;
  };

  const renderTimelineItem = (item, index) => {
    const hora = formatarHora(item);
    const end = getEndereco(item);

    let titulo = 'Buscando endereço...';
    let subtitulo = '';

    if (end === null) {
      titulo = 'Endereço não disponível';
      subtitulo = `Lat: ${item.latitude.toFixed(4)}, Long: ${item.longitude.toFixed(4)}`;
    } else if (end) {
      const info = normalizarEndereco(end);
      if (info.logradouro && info.logradouro !== 'Via') {
        titulo = info.numero ? `${info.logradouro}, ${info.numero}` : info.logradouro;
      } else if (info.cidade) {
        titulo = info.cidade;
      } else {
        titulo = 'Local identificado';
      }

      const partes = [];
      if (info.bairro) partes.push(info.bairro);
      if (info.cidade && info.estado) partes.push(`${info.cidade} - ${info.estado}`);
      else if (info.cidade) partes.push(info.cidade);
      if (info.cep) partes.push(`CEP ${info.cep}`);
      subtitulo = partes.length > 0 ? partes.join(' • ') : '';
    }

    return (
      <View key={index} style={styles.timelineItem}>
        <View style={styles.timelineLeft}>
          <Text style={styles.timelineHora}>{hora}</Text>
          <View style={styles.timelineDot}><View style={styles.timelineDotInner} /></View>
          {index < localizacoesFiltradas.length - 1 && <View style={styles.timelineLine} />}
        </View>
        <View style={styles.timelineRight}>
          <Text style={styles.timelineLocal} numberOfLines={2}>{titulo}</Text>
          {subtitulo ? <Text style={styles.timelineBairro} numberOfLines={2}>{subtitulo}</Text> : null}
          <Text style={styles.timelineEndereco}>Lat: {item.latitude.toFixed(4)} | Long: {item.longitude.toFixed(4)}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleVoltar} style={styles.backButton}><Ionicons name="chevron-back" size={28} color="#1A237E" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Histórico de localização</Text>
        <TouchableOpacity onPress={handleLimparHistorico} style={styles.deleteButton}><Ionicons name="trash-outline" size={24} color="#DC2626" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Filtros */}
        <View style={styles.filtrosContainer}>
          <TouchableOpacity style={[styles.filtroBotao, filtro === 'hoje' && styles.filtroAtivo]} onPress={() => setFiltro('hoje')}>
            <Text style={[styles.filtroTexto, filtro === 'hoje' && styles.filtroTextoAtivo]}>Hoje</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtroBotao, filtro === 'ontem' && styles.filtroAtivo]} onPress={() => setFiltro('ontem')}>
            <Text style={[styles.filtroTexto, filtro === 'ontem' && styles.filtroTextoAtivo]}>Ontem</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filtroBotao, filtro === '7dias' && styles.filtroAtivo]} onPress={() => setFiltro('7dias')}>
            <Text style={[styles.filtroTexto, filtro === '7dias' && styles.filtroTextoAtivo]}>7 dias</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>{renderMapa()}</View>

        {localizacoesFiltradas.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="time-outline" size={50} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Nenhum registro</Text>
            <Text style={styles.emptySubtitle}>Ainda não há histórico de localização neste período.</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {localizacoesFiltradas.map((item, index) => renderTimelineItem(item, index))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('alerta')}><Ionicons name="notifications-outline" size={22} color="#9CA3AF" /><Text style={styles.navText}>Alertas</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('inicio')}><Ionicons name="home-outline" size={22} color="#9CA3AF" /><Text style={styles.navText}>Início</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('perfil')}><Ionicons name="person-outline" size={22} color="#9CA3AF" /><Text style={styles.navText}>Perfil</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  deleteButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  
  filtrosContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 8 },
  filtroBotao: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  filtroAtivo: { backgroundColor: '#E0E7FF', borderColor: '#1E3A8A' },
  filtroTexto: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  filtroTextoAtivo: { color: '#1E3A8A' },
  
  mapContainer: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E0F2FE', marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  map: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  mapPlaceholderText: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 10 },
  
  timelineContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
  timelineItem: { flexDirection: 'row', minHeight: 80 },
  timelineLeft: { width: 60, alignItems: 'center', position: 'relative' },
  timelineHora: { fontSize: 11, color: '#6B7280', fontWeight: '600', marginBottom: 5 },
  timelineDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#1E3A8A', backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  timelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1E3A8A' },
  timelineLine: { position: 'absolute', top: 45, bottom: -15, width: 2, backgroundColor: '#E5E7EB' },
  timelineRight: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  timelineLocal: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginBottom: 2 },
  timelineBairro: { fontSize: 12, color: '#6B7280', marginBottom: 2, lineHeight: 16 },
  timelineEndereco: { fontSize: 10, color: '#9CA3AF', lineHeight: 14, marginTop: 2 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A8A', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6 },
  
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', elevation: 10 },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  navText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
});