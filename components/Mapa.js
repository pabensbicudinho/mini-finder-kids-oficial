import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { salvarLocalizacao, listarLocalizacoes, listarRotas } from '../services/firestoreService';
import { treinarModelo, analisarPosicao, analisarRota } from '../services/iaService';

export default function Mapa({ userData, loggedUser, onNavigate }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [iaInicializada, setIaInicializada] = useState(false);
  const [alertaDisparado, setAlertaDisparado] = useState(false);
  const [statusRota, setStatusRota] = useState(null);

  const insets = useSafeAreaInsets();
  const webMapRef = useRef(null);
  const webMarkerRef = useRef(null);
  const webMapContainerRef = useRef(null);
  const webViewRef = useRef(null);
  const iaModeloRef = useRef({ modelo: null, perimetros: [] });
  const rotaRef = useRef(null);
  const alertaDisparadoRef = useRef(false); // Ref para não travar o useEffect

  const nomeCrianca = userData?.nome || 'Criança';

  // ============================================================
  // 🧠 IA: TREINAR MODELO + CARREGAR ROTA E PERÍMETROS AO ABRIR
  // ============================================================
  useEffect(() => {
    let ativo = true;
    const inicializarIA = async () => {
      if (!userData?.id) return;
      try {
        const [historico, rotas] = await Promise.all([
          listarLocalizacoes(userData.id),
          listarRotas(userData.id),
        ]);
        const modelo = treinarModelo(historico || []);
        if (!ativo) return;

        // 🔑 Popula os perímetros para a análise de área segura funcionar
        const perimetros = (rotas || []).map((r) => ({
          latitude: r.latitudeDestino,
          longitude: r.longitudeDestino,
          raio: r.raio || 500,
          nome: r.nome || 'Área Segura',
        }));

        iaModeloRef.current = { modelo, perimetros };
        if (rotas && rotas.length > 0) rotaRef.current = rotas[0];
        setIaInicializada(true);

        console.log('🧠 IA inicializada:', {
          modelo,
          rota: !!rotaRef.current,
          perimetros: perimetros.length,
        });
      } catch (error) { console.error('Erro IA:', error); }
    };
    inicializarIA();
    return () => { ativo = false; };
  }, [userData]);

  // ============================================================
  // LOCALIZAÇÃO — WEB (CRIANÇA) ENVIA | APK (RESPONSÁVEL) LÊ
  // ============================================================
  useEffect(() => {
    let locationSubscription = null;
    let intervalId = null;
    let isMounted = true;

    // ============================================================
    // MODO CRIANÇA (WEB) - Envia localização do navegador
    // ============================================================
    if (Platform.OS === 'web') {
      const iniciarWeb = async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            if (isMounted) setErrorMsg('Permissão de localização negada.');
            return;
          }

          // Posição inicial
          const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          if (isMounted && currentLocation) {
            setLocation(currentLocation.coords);
            if (userData?.id) {
              await salvarLocalizacao(userData.id, currentLocation.coords.latitude, currentLocation.coords.longitude);
            }
          }

          // Watch contínuo
          locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 5 },
            async (newLocation) => {
              if (!isMounted) return;
              setLocation(newLocation.coords);
              if (userData?.id) {
                await salvarLocalizacao(userData.id, newLocation.coords.latitude, newLocation.coords.longitude);
              }
            }
          );
        } catch (error) {
          console.error('Erro GPS Web:', error);
          if (isMounted) setErrorMsg('Erro ao obter localização.');
        }
      };
      iniciarWeb();
    }

    // ============================================================
    // MODO RESPONSÁVEL (APK) - Lê do Firestore a cada 5s
    // ============================================================
    if (Platform.OS !== 'web') {
      const buscarLocalizacao = async () => {
        try {
          if (!userData?.id || !isMounted) return;
          const locs = await listarLocalizacoes(userData.id);
          if (locs && locs.length > 0 && isMounted) {
            const ultima = locs[0];
            setLocation({
              latitude: ultima.latitude,
              longitude: ultima.longitude,
            });
            console.log('📍 APK recebeu localização:', ultima.latitude, ultima.longitude);
          }
        } catch (error) {
          console.log('Erro ao buscar localização (APK):', error);
        }
      };

      // Busca imediatamente
      buscarLocalizacao();

      // E depois a cada 5 segundos
      intervalId = setInterval(buscarLocalizacao, 5000);
    }

    return () => {
      isMounted = false;
      if (locationSubscription) locationSubscription.remove();
      if (intervalId) clearInterval(intervalId);
    };
  }, [userData]);

  // ============================================================
  // 🧠 ANÁLISE DE IA (RODA NO APK, BASEADO NA LOCALIZAÇÃO RECEBIDA)
  // ============================================================
  useEffect(() => {
    if (Platform.OS === 'web' || !location || !iaInicializada) return;
    if (alertaDisparadoRef.current) return; // Se já disparou, não dispara de novo

    const { modelo, perimetros } = iaModeloRef.current;
    const posicaoAtual = { latitude: location.latitude, longitude: location.longitude };

    const analiseComportamento = analisarPosicao({ posicaoAtual, modelo, perimetros });
    const analiseRota = analisarRota({ posicaoAtual, rota: rotaRef.current });

    setStatusRota(analiseRota.status);

    const desviou = analiseRota.status === 'desviou_rota';
    console.log('🧠 Análise IA:', { analiseComportamento, analiseRota });

    if (analiseComportamento.anomalia || desviou) {
      alertaDisparadoRef.current = true;
      setAlertaDisparado(true);

      Alert.alert(
        '⚠️ Alerta',
        desviou ? analiseRota.motivo : analiseComportamento.motivo,
        [
          { text: 'Ficar aqui', style: 'cancel' },
          { text: 'Ver alerta', onPress: () => onNavigate('alerta', userData) },
        ]
      );
    }
  }, [location, iaInicializada, onNavigate, userData]);

  // ============================================================
  // HTML DO MAPA PARA ANDROID / IOS
  // ============================================================
  const gerarHTML = (lat, lng, nome, rota) => {
    const nomeSeguro = String(nome).replace(/'/g, "\\'");
    let rotaJS = '';
    if (rota && rota.coordenadas && rota.coordenadas.length > 0) {
      const pontos = JSON.stringify(rota.coordenadas.map((p) => [p.latitude, p.longitude]));
      rotaJS = `var polyline = L.polyline(${pontos}, { color: '#1E3A8A', weight: 5, dashArray: '8, 8' }).addTo(map);`;
    }
    return `
      <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>html, body { margin: 0; padding: 0; width: 100%; height: 100%; } #map { width: 100%; height: 100%; }</style>
      </head><body><div id="map"></div><script>
        var map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 15);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        ${rotaJS}
        var marker = L.marker([${lat}, ${lng}]).addTo(map);
        marker.bindPopup("<b>${nomeSeguro}</b>").openPopup();
        document.addEventListener('message', function(event) {
          try {
            var data = JSON.parse(event.data);
            if (data.latitude && data.longitude) {
              marker.setLatLng([data.latitude, data.longitude]);
              map.setView([data.latitude, data.longitude], map.getZoom());
            }
          } catch (e) {}
        });
      </script></body></html>
    `;
  };

  // ============================================================
  // ATUALIZA MAPA NATIVO (envia nova posição pro WebView)
  // ============================================================
  useEffect(() => {
    if (Platform.OS !== 'web' && location && webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
      }));
    }
  }, [location]);

  // ============================================================
  // MAPA WEB
  // ============================================================
  useEffect(() => {
    if (Platform.OS !== 'web' || !location || !webMapContainerRef.current) return;
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

        if (!webMapRef.current) {
          webMapRef.current = L.map(webMapContainerRef.current).setView([location.latitude, location.longitude], 16);
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(webMapRef.current);
          
          delete L.Icon.Default.prototype._getIconUrl;
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          });

          webMarkerRef.current = L.marker([location.latitude, location.longitude]).addTo(webMapRef.current);
        } else {
          if (webMarkerRef.current) {
            webMarkerRef.current.setLatLng([location.latitude, location.longitude]);
            webMapRef.current.setView([location.latitude, location.longitude], webMapRef.current.getZoom());
          }
        }
      } catch (error) { console.error('Erro mapa Web:', error); }
    };
    iniciarMapaWeb();
    return () => { ativo = false; };
  }, [location]);

  // ============================================================
  // RENDERIZAÇÃO DO MAPA
  // ============================================================
  const renderMapa = () => {
    if (errorMsg) {
      return (
        <View style={styles.mapErrorContainer}>
          <Ionicons name="location-outline" size={40} color="#DC2626" />
          <Text style={styles.mapErrorText}>{errorMsg}</Text>
        </View>
      );
    }

    if (!location) {
      return (
        <View style={styles.mapLoadingContainer}>
          <Ionicons name="navigate-outline" size={36} color="#1E3A8A" />
          <Text style={styles.mapLoadingText}>Buscando sinal do GPS...</Text>
        </View>
      );
    }

    if (Platform.OS !== 'web') {
      return (
        <WebView
          ref={webViewRef}
          style={styles.map}
          originWhitelist={['*']}
          source={{ html: gerarHTML(location.latitude, location.longitude, nomeCrianca, rotaRef.current) }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
        />
      );
    }

    return <View ref={webMapContainerRef} style={styles.map} />;
  };

  // ============================================================
  // INTERFACE
  // ============================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('inicio')} style={styles.backButton} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#1A237E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Localização</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* CARD DE SAUDAÇÃO */}
      <View style={styles.greetingCard}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={26} color="#1E3A8A" />
        </View>
        <View style={styles.greetingTextContainer}>
          <Text style={styles.greetingTitle}>Olá, {nomeCrianca} está seguro(a)!</Text>
          <Text style={styles.greetingSubtitle}>Última atualização: agora</Text>
        </View>
      </View>

      {/* MAPA */}
      <View style={styles.mapContainer}>
        {renderMapa()}
        <View style={styles.gpsInfo}>
          <Text style={styles.gpsInfoText}>
            {location ? `Lat: ${location.latitude.toFixed(4)} | Long: ${location.longitude.toFixed(4)}` : 'Aguardando GPS...'}
          </Text>
        </View>
      </View>

      {/* STATUS - LINHA 1 (3 primeiros) */}
      <View style={styles.statusRow}>
        <TouchableOpacity style={styles.statusItem} onPress={() => onNavigate('perfilCrianca', userData)} activeOpacity={0.7}>
          <View style={styles.statusIconCircle}><Ionicons name="person-outline" size={24} color="#1E3A8A" /></View>
          <Text style={styles.statusText}>Perfil criança</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statusItem} onPress={() => onNavigate('historicoCrianca', userData)} activeOpacity={0.7}>
          <View style={styles.statusIconCircle}><Ionicons name="time-outline" size={24} color="#1E3A8A" /></View>
          <Text style={styles.statusText}>Ver histórico</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statusItem} onPress={() => onNavigate('novaRota', userData)} activeOpacity={0.7}>
          <View style={styles.statusIconCircle}><Ionicons name="shield-checkmark-outline" size={24} color="#1E3A8A" /></View>
          <Text style={styles.statusText}>Área segura</Text>
        </TouchableOpacity>
      </View>

      {/* STATUS - LINHA 2 (Microfone e Câmera) */}
      <View style={styles.statusRowSecondary}>
        <TouchableOpacity style={styles.statusItem} onPress={() => onNavigate('historicoMicrofone', userData)} activeOpacity={0.7}>
          <View style={styles.statusIconCircle}><Ionicons name="mic-outline" size={24} color="#1E3A8A" /></View>
          <Text style={styles.statusText}>Microfone</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statusItem} onPress={() => onNavigate('historicoCamera', userData)} activeOpacity={0.7}>
          <View style={styles.statusIconCircle}><Ionicons name="camera-outline" size={24} color="#1E3A8A" /></View>
          <Text style={styles.statusText}>Câmera</Text>
        </TouchableOpacity>
      </View>

      {/* MENU INFERIOR */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('alerta')} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>Alertas</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('inicio')} activeOpacity={0.7}>
          <Ionicons name="home" size={22} color="#1E3A8A" />
          <Text style={styles.navTextActive}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('perfil')} activeOpacity={0.7}>
          <Ionicons name="person-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A237E' },
  headerSpacer: { width: 40 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  
  greetingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 16, marginHorizontal: 20, marginTop: 15, marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E0E7FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  greetingTextContainer: { flex: 1 },
  greetingTitle: { fontSize: 15, fontWeight: '700', color: '#1E3A8A' },
  greetingSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  
  mapContainer: { height: 220, borderRadius: 20, overflow: 'hidden', marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#E0F2FE', position: 'relative' },
  map: { width: '100%', height: '100%' },
  mapLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0F2FE' },
  mapLoadingText: { fontSize: 13, color: '#6B7280', marginTop: 8 },
  mapErrorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FEE2E2', padding: 20 },
  mapErrorText: { fontSize: 13, color: '#DC2626', textAlign: 'center', marginTop: 8 },
  gpsInfo: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: 6, borderRadius: 8 },
  gpsInfoText: { fontSize: 10, color: '#333333', textAlign: 'center' },
  
  statusRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, paddingHorizontal: 10 },
  statusRowSecondary: { flexDirection: 'row', justifyContent: 'center', gap: 30, marginBottom: 20, paddingHorizontal: 10 },
  statusItem: { alignItems: 'center', width: 90 },
  statusIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 5, elevation: 2 },
  statusText: { fontSize: 12, color: '#4B5563', fontWeight: '500', textAlign: 'center' },
  
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', elevation: 10 },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  navText: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  navTextActive: { fontSize: 11, color: '#1E3A8A', fontWeight: '700', marginTop: 2 },
});