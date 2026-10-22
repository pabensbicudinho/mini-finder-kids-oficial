import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Login from './components/Login';
import Cadastro from './components/Cadastro';
import Inicio from './components/Inicio';
import NovaCrianca from './components/NovaCriancas';
import Mapa from './components/Mapa';
import Perfil from './components/Perfil';
import PerfilCrianca from './components/PerfilCrianca';
import PerimetrosSeguros from './components/PerimetrosSeguros';
import Alerta from './components/Alerta';
import MapaCriancaAlerta from './components/MapaCriancaAlerta';
import NovaRota from './components/NovaRota';
import RotaDetalhes from './components/RotaDetalhes';
import HistoricoCrianca from './components/HistoricoCrianca';
import HistoricoMicrofone from './components/HistoricoMicrofone';
import HistoricoCamera from './components/HistoricoCamera';
import CameraCapture from './components/CameraCapture';
import Debug from './components/Debug';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [previousScreen, setPreviousScreen] = useState('inicio');
  const [loggedUser, setLoggedUser] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);

  const navigateTo = (screen, data = null) => {
    console.log('🟣 navigateTo:', { screen, data: data?.nome || data, currentScreen });

    if (screen !== currentScreen) {
      setPreviousScreen(currentScreen);
    }

    if (screen === 'inicio' && data) {
      setLoggedUser(data);
      setSelectedChild(null);
    }
    else if (screen === 'login') {
      setLoggedUser(null);
      setSelectedChild(null);
    }
    else if (
      screen === 'mapa' ||
      screen === 'perfilCrianca' ||
      screen === 'mapaCriancaAlerta' ||
      screen === 'alerta' ||
      screen === 'novaRota' ||
      screen === 'rotaDetalhes' ||
      screen === 'historicoCrianca' ||
      screen === 'historicoMicrofone' ||
      screen === 'historicoCamera' ||
      screen === 'cameraCapture' ||
      screen === 'perimetrosSeguros'
    ) {
      if (data) setSelectedChild(data);
    }

    setCurrentScreen(screen);
  };

  return (
    <SafeAreaProvider>
      {/* AUTENTICAÇÃO */}
      {currentScreen === 'login' && <Login onNavigate={navigateTo} />}
      {currentScreen === 'cadastro' && <Cadastro onNavigate={navigateTo} />}

      {/* TELAS PRINCIPAIS */}
      {currentScreen === 'inicio' && (
        <Inicio userData={loggedUser} onNavigate={navigateTo} />
      )}
      {currentScreen === 'perfil' && (
        <Perfil
          userData={loggedUser}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}

      {/* 🔑 CORREÇÃO AQUI: Passando o loggedUser para a tela de nova criança */}
      {currentScreen === 'novaCriancas' && (
        <NovaCrianca userData={loggedUser} onNavigate={navigateTo} />
      )}
      
      {currentScreen === 'mapa' && (
        <Mapa 
          userData={selectedChild} 
          loggedUser={loggedUser} 
          onNavigate={navigateTo} 
        />
      )}
      
      {currentScreen === 'perfilCrianca' && (
        <PerfilCrianca userData={selectedChild} onNavigate={navigateTo} />
      )}

      {/* PERÍMETROS SEGUROS */}
      {currentScreen === 'perimetrosSeguros' && (
        <PerimetrosSeguros
          userData={selectedChild}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}

      {/* TELAS DE ROTA / ÁREA SEGURA */}
      {currentScreen === 'novaRota' && (
        <NovaRota
          userData={selectedChild}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}
      {currentScreen === 'rotaDetalhes' && (
        <RotaDetalhes
          userData={selectedChild}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}

      {/* TELAS DE HISTÓRICO */}
      {currentScreen === 'historicoCrianca' && (
        <HistoricoCrianca
          userData={selectedChild}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}
      {currentScreen === 'historicoMicrofone' && (
        <HistoricoMicrofone
          userData={selectedChild}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}
      {currentScreen === 'historicoCamera' && (
        <HistoricoCamera
          userData={selectedChild}
          onNavigate={navigateTo}
          previousScreen={previousScreen}
        />
      )}

      {/* TELAS DE CAPTURA */}
      {currentScreen === 'cameraCapture' && (
        <CameraCapture
          userData={selectedChild}
          onNavigate={navigateTo}
        />
      )}

      {/* TELAS DE ALERTA */}
      {currentScreen === 'alerta' && (
        <Alerta userData={selectedChild} onNavigate={navigateTo} />
      )}
      {currentScreen === 'mapaCriancaAlerta' && (
        <MapaCriancaAlerta userData={selectedChild} onNavigate={navigateTo} />
      )}

      {/* DEBUG */}
      {currentScreen === 'debug' && <Debug onNavigate={navigateTo} />}
    </SafeAreaProvider>
  );
}