import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Paper,
  Divider,
  Container,
  IconButton,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import ScaleIcon from '@mui/icons-material/Scale';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { apiService, Animal } from '../services/apiService.ts';

interface PetBindingProps {
  onBack: () => void;
}

const PetBinding: React.FC<PetBindingProps> = ({ onBack }) => {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    animal_type: '',
    weight: '' as string | number, // Will be auto-populated from weight sensor, allow empty string
    food_portion: 0.2,
    food_level: 2.5,
    container_id: 1,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [weightDetected, setWeightDetected] = useState(false);
  const [bindingMode, setBindingMode] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [pollIntervalRef, setPollIntervalRef] = useState<NodeJS.Timeout | null>(null);

  // Stop weight detection (manual stop without clearing)
  const stopWeightDetection = async () => {
    if (pollIntervalRef) {
      clearInterval(pollIntervalRef);
      setPollIntervalRef(null);
    }
    setBindingMode(false);
    
    // Send MQTT message to disable weight sensor
    try {
      await apiService.controlWeightSensor(1, false);
      console.log('Weight sensor 1 disabled');
    } catch (err) {
      console.error('Failed to disable weight sensor:', err);
    }
    
    // Keep the detected weight, just stop polling
    const weightNum = typeof formData.weight === 'string' ? parseFloat(formData.weight) : formData.weight;
    if (weightNum > 0) {
      setSuccess(`Weight reading stopped at: ${weightNum.toFixed(2)}kg. You can manually adjust if needed.`);
    } else {
      setError('No weight detected yet');
    }
  };

  // Cancel weight detection (clear everything)
  const cancelWeightDetection = async () => {
    if (pollIntervalRef) {
      clearInterval(pollIntervalRef);
      setPollIntervalRef(null);
    }
    setBindingMode(false);
    setWeightDetected(false);
    setFormData(prev => ({
      ...prev,
      weight: '' // Reset to empty string
    }));
    
    // Send MQTT message to disable weight sensor
    try {
      await apiService.controlWeightSensor(1, false);
      console.log('Weight sensor 1 disabled');
    } catch (err) {
      console.error('Failed to disable weight sensor:', err);
    }
    
    // Clear backend weight sensor data
    try {
      await apiService.clearWeightSensor(1);
      console.log('Weight sensor data cleared');
    } catch (err) {
      console.error('Failed to clear weight sensor:', err);
    }
    
    setSuccess(null);
    setError('Weight detection cancelled');
  };

  // Start weight detection - poll weight sensor 1 (continuous mode)
  const startWeightDetection = async () => {
    // Clear any existing interval
    if (pollIntervalRef) {
      clearInterval(pollIntervalRef);
    }

    // Clear old weight data from backend
    try {
      await apiService.clearWeightSensor(1);
      console.log('Previous weight sensor data cleared');
    } catch (err) {
      console.error('Failed to clear weight sensor:', err);
    }

    // Send MQTT message to enable weight sensor
    try {
      await apiService.controlWeightSensor(1, true);
      console.log('Weight sensor 1 enabled');
    } catch (err) {
      console.error('Failed to enable weight sensor:', err);
    }

    setBindingMode(true);
    setWeightDetected(false);
    setError(null);
    setSuccess(null);
    setFormData(prev => ({
      ...prev,
      weight: ''  // Reset weight to empty string when starting new detection
    }));

    // Poll weight sensor every 500ms - continuous updates
    const interval = setInterval(async () => {
      try {
        const response: any = await apiService.getWeightSensor(1);
        
        if (response.success && response.weight !== null && response.weight !== undefined) {
          const detectedWeight = parseFloat(response.weight);
          
          if (detectedWeight > 0) {
            // Update weight continuously (don't stop automatically)
            setFormData(prev => ({
              ...prev,
              weight: detectedWeight
            }));
            setWeightDetected(true);
            setSuccess(`📊 Current weight: ${detectedWeight.toFixed(2)}kg (Click "Stop Detection" to keep this value)`);
            // Don't clear interval - keep updating
          }
        }
      } catch (err) {
        console.error('Failed to read weight sensor:', err);
      }
    }, 500);

    setPollIntervalRef(interval);

    // Stop polling after 60 seconds if user doesn't manually stop
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setPollIntervalRef(null);
        setBindingMode(false);
        
        // Disable weight sensor on timeout
        apiService.controlWeightSensor(1, false).catch(err => {
          console.error('Failed to disable weight sensor on timeout:', err);
        });
        
        const weightNum = typeof formData.weight === 'string' ? parseFloat(formData.weight) : formData.weight;
        if (weightNum > 0) {
          setSuccess(`⏱️ Detection timeout. Final weight: ${weightNum.toFixed(2)}kg`);
        } else {
          setError('⚠️ Weight detection timeout. No weight detected.');
        }
      }
    }, 60000);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate form
      if (!formData.name.trim()) {
        throw new Error('Pet name is required');
      }
      if (!formData.animal_type) {
        throw new Error('Animal type is required');
      }

      // Convert weight to number for API
      const weightNum = typeof formData.weight === 'string' ? parseFloat(formData.weight) : formData.weight;
      if (!weightNum || weightNum <= 0) {
        throw new Error('Valid weight is required');
      }

      const response = await apiService.bindPet({
        ...formData,
        weight: weightNum
      });
      
      if ((response as any).success) {
        setSuccess(`✅ Pet binding completed! ${formData.name} is now bound to Container ${formData.container_id}`);
        
        // Auto-navigate back after success
        setTimeout(() => {
          onBack();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to bind pet');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnimals = async () => {
    try {
      const response = await apiService.getAllPets();
      setAnimals((response as any).animals || []);
    } catch (err) {
      console.error('Failed to fetch animals:', err);
    }
  };

  useEffect(() => {
    fetchAnimals();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" gutterBottom>
            🐾 Pet Binding
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Bind your pet to a smart feeding container with weight detection.
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3} mt={1}>
        {/* Binding Form */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🔗 Bind New Pet
              </Typography>

              {/* Weight Detection Simulation */}
              <Paper elevation={1} sx={{ p: 2, mb: 3, backgroundColor: bindingMode ? '#f3e5f5' : '#f5f5f5' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Weight Sensor Status
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {bindingMode ? 'Pet Binding Mode Active' : 'Standby Mode'}
                    </Typography>
                  </Box>
                  <Box>
                    {!bindingMode ? (
                      <Button 
                        variant="contained" 
                        startIcon={<ScaleIcon />}
                        onClick={startWeightDetection}
                        color="primary"
                      >
                        Start Weight Detection
                      </Button>
                    ) : (
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box display="flex" alignItems="center">
                          <CircularProgress size={20} sx={{ mr: 1 }} />
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {weightDetected ? `Reading: ${typeof formData.weight === 'number' ? formData.weight.toFixed(2) : formData.weight}kg` : 'Waiting for weight...'}
                          </Typography>
                        </Box>
                        <Button 
                          variant="contained" 
                          size="small"
                          onClick={stopWeightDetection}
                          color="success"
                        >
                          Stop Detection
                        </Button>
                        <Button 
                          variant="outlined" 
                          size="small"
                          onClick={cancelWeightDetection}
                          color="error"
                        >
                          Cancel
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Paper>

              {/* Pet Binding Form */}
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Pet Name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      required
                      disabled={!weightDetected}
                      placeholder="e.g., Whiskers"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required disabled={!weightDetected}>
                      <InputLabel>Animal Type</InputLabel>
                      <Select
                        value={formData.animal_type}
                        label="Animal Type"
                        onChange={(e) => handleInputChange('animal_type', e.target.value)}
                      >
                        <MenuItem value="Cat">Cat</MenuItem>
                        <MenuItem value="Dog">Dog</MenuItem>
                        <MenuItem value="Rabbit">Rabbit</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Weight (kg)"
                      type="number"
                      value={formData.weight}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow empty string or valid number
                        handleInputChange('weight', val === '' ? '' : parseFloat(val) || '');
                      }}
                      inputProps={{ step: 0.1, min: 0 }}
                      required
                      disabled={!bindingMode && formData.weight === ''}
                      helperText={
                        !bindingMode && formData.weight === '' 
                          ? "Click 'Start Weight Detection' first to enable" 
                          : bindingMode 
                          ? "Auto-updating from sensor (you can manually edit anytime)" 
                          : "Weight detected. You can manually adjust if needed"
                      }
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: bindingMode ? '#e3f2fd' : 'inherit',
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Container ID"
                      type="number"
                      value={formData.container_id}
                      onChange={(e) => handleInputChange('container_id', parseInt(e.target.value))}
                      inputProps={{ min: 1 }}
                      required
                      disabled={!weightDetected}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Food Portion per Feeding (kg)"
                      type="number"
                      value={formData.food_portion}
                      onChange={(e) => handleInputChange('food_portion', parseFloat(e.target.value))}
                      inputProps={{ step: 0.05, min: 0.05 }}
                      required
                      disabled={!weightDetected}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Initial Food Level (kg)"
                      type="number"
                      value={formData.food_level}
                      onChange={(e) => handleInputChange('food_level', parseFloat(e.target.value))}
                      inputProps={{ step: 0.1, min: 0 }}
                      required
                      disabled={!weightDetected}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box display="flex" gap={2}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading || !weightDetected}
                        startIcon={loading ? <CircularProgress size={20} /> : <PetsIcon />}
                      >
                        {loading ? 'Binding Pet...' : 'Complete Pet Binding'}
                      </Button>
                      
                      {bindingMode && (
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setBindingMode(false);
                            setWeightDetected(false);
                            setSuccess(null);
                          }}
                        >
                          Cancel Binding
                        </Button>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* Animals List */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🐾 Registered Animals
              </Typography>
              
              {animals.length === 0 ? (
                <Alert severity="info">
                  No animals registered yet.
                </Alert>
              ) : (
                <Box>
                  {animals.map((animal, index) => (
                    <Box key={animal.id}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" py={1}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {animal.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {animal.animal_type} • {animal.weight}kg
                          </Typography>
                        </Box>
                        <Chip 
                          label={`Container ${animal.container_id}`}
                          color="primary"
                          size="small"
                        />
                      </Box>
                      {index < animals.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Status Messages */}
      {success && (
        <Alert severity="success" sx={{ mt: 3 }}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}
    </Container>
  );
};

export default PetBinding;