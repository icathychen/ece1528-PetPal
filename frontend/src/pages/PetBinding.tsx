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
    weight: 3.1, // Auto-populated weight
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

  // Simulate weight detection
  const simulateWeightDetection = () => {
    setBindingMode(true);
    setWeightDetected(false);
    setError(null);
    setSuccess(null);

    // Simulate weight sensor activation
    setTimeout(() => {
      const simulatedWeight = 3.1; // Simulated detected weight
      setFormData(prev => ({
        ...prev,
        weight: simulatedWeight
      }));
      setWeightDetected(true);
      setSuccess(`Weight detected: ${simulatedWeight}kg`);
    }, 2000);
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

      const response = await apiService.bindPet(formData);
      
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
                        onClick={simulateWeightDetection}
                        color="primary"
                      >
                        Start Weight Detection
                      </Button>
                    ) : weightDetected ? (
                      <Chip label="Weight Detected!" color="success" icon={<ScaleIcon />} />
                    ) : (
                      <Box display="flex" alignItems="center">
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body2">Detecting weight...</Typography>
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
                      onChange={(e) => handleInputChange('weight', parseFloat(e.target.value))}
                      inputProps={{ step: 0.1, min: 0.1 }}
                      disabled // Auto-populated from weight sensor
                      helperText="Auto-detected from weight sensor"
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