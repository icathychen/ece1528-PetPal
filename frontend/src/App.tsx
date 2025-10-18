import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppBar, Toolbar, Typography, Chip, Box } from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import Dashboard from './pages/Dashboard.tsx';
import AnimalDetail from './pages/AnimalDetail.tsx';
import PetBinding from './pages/PetBinding.tsx';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2E7D32',
    },
    secondary: {
      main: '#1976d2',
    },
  },
});

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'animal' | 'binding'>('dashboard');
  const [selectedAnimalId, setSelectedAnimalId] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  const handleAnimalSelect = (animalId: number) => {
    setSelectedAnimalId(animalId);
    setCurrentView('animal');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedAnimalId(null);
  };

  const handleShowBinding = () => {
    setCurrentView('binding');
  };

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }));
    };

    // Update immediately
    updateTime();
    
    // Then update every second
    const interval = setInterval(updateTime, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="App">
        <AppBar position="static" sx={{ backgroundColor: '#2E7D32' }}>
          <Toolbar>
            <PetsIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              🐾 PetPal Smart Feeding System
            </Typography>
            
            {/* Live Clock */}
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'white', 
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                🕐 {currentTime}
              </Typography>
            </Box>
            
            <Chip 
              label="Online" 
              color="success" 
              variant="outlined" 
              size="small"
              sx={{ color: 'white', borderColor: 'white' }}
            />
          </Toolbar>
        </AppBar>

        <main>
          {currentView === 'dashboard' && (
            <Dashboard 
              onAnimalSelect={handleAnimalSelect}
              onShowBinding={handleShowBinding}
            />
          )}
          {currentView === 'animal' && selectedAnimalId && (
            <AnimalDetail 
              animalId={selectedAnimalId}
              onBack={handleBackToDashboard}
            />
          )}
          {currentView === 'binding' && (
            <PetBinding 
              onBack={handleBackToDashboard}
            />
          )}
        </main>
      </div>
    </ThemeProvider>
  );
}

export default App;