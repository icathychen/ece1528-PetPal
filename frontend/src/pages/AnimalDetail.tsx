import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  IconButton,
  Chip,
  Alert,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PetsIcon from '@mui/icons-material/Pets';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { apiService, Animal, FeedingSchedule, LogEntry } from '../services/apiService.ts';

interface AnimalDetailProps {
  animalId: number;
  onBack: () => void;
}

const AnimalDetail: React.FC<AnimalDetailProps> = ({ animalId, onBack }) => {
  // Data state
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [schedules, setSchedules] = useState<FeedingSchedule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Schedule form state
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    schedule_time: '08:00',
    food_amount: 0.2,
  });
  
  // Manual feeding state
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [manualFeedingAmount, setManualFeedingAmount] = useState(0.2);
  const [manualFeeding, setManualFeeding] = useState(false);

  const fetchAnimalData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all animals and find the specific one
      const animalsRes = await apiService.getAllPets();
      const animals = (animalsRes as any).animals || [];
      const currentAnimal = animals.find((a: Animal) => a.id === animalId);
      
      if (!currentAnimal) {
        throw new Error('Animal not found');
      }
      
      setAnimal(currentAnimal);
      
      // Get schedules for this container
      const schedulesRes = await apiService.getAllSchedules(currentAnimal.container_id);
      setSchedules((schedulesRes as any).schedules || []);
      
      // Get logs for this container
      const logsRes = await apiService.getFeedingLogs(currentAnimal.container_id, 20);
      setLogs((logsRes as any).logs || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load animal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnimalData();
  }, [animalId]);

  const handleCreateSchedule = async () => {
    if (!animal) return;
    
    try {
      const timeWithSeconds = scheduleForm.schedule_time + ':00';
      
      const scheduleData = {
        animal_id: animal.id,
        container_id: animal.container_id,
        schedule_time: timeWithSeconds,
        food_amount: scheduleForm.food_amount,
      };

      const response = await apiService.createSchedule(scheduleData);
      
      if ((response as any).success) {
        setSuccess(`✅ New feeding schedule created for ${scheduleForm.schedule_time}`);
        setShowScheduleDialog(false);
        setScheduleForm({ schedule_time: '08:00', food_amount: animal.food_portion });
        fetchAnimalData(); // Refresh data
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    }
  };

  const handleManualFeeding = async () => {
    if (!animal) return;
    
    try {
      setManualFeeding(true);
      
      const response = await apiService.triggerManualFeeding({
        container_id: animal.container_id,
        food_amount: manualFeedingAmount,
      });
      
      if ((response as any).success) {
        setSuccess(`🍽️ Manual feeding triggered! Dispensing ${manualFeedingAmount}kg food...`);
        setShowManualDialog(false);
        
        // Simulate feeding process
        setTimeout(() => {
          setSuccess(`✅ Feeding completed for ${animal.name}!`);
          fetchAnimalData(); // Refresh data to show updated food level
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger feeding');
    } finally {
      setManualFeeding(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading animal details...
        </Typography>
      </Container>
    );
  }

  if (!animal) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Animal not found</Alert>
        <Button onClick={onBack} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  const quickPresets = [
    { label: 'Morning', time: '08:00' },
    { label: 'Noon', time: '12:00' },
    { label: 'Evening', time: '18:00' },
    { label: 'Night', time: '22:00' },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={onBack} sx={{ mr: 2 }}>
          <ArrowBackIcon />
        </IconButton>
        <PetsIcon sx={{ mr: 2, fontSize: 32 }} color="primary" />
        <Box flexGrow={1}>
          <Typography variant="h4" fontWeight="bold">
            {animal.name}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {animal.animal_type} • Container {animal.container_id} • {animal.weight}kg
          </Typography>
        </Box>
        <Chip 
          label={animal.food_level < 1.5 ? 'Low Food' : 'Food OK'}
          color={animal.food_level < 1.5 ? 'warning' : 'success'}
        />
      </Box>

      {/* Status Messages */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Pet Info Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🐾 Pet Information
              </Typography>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Name</Typography>
                <Typography variant="body1" fontWeight="bold">{animal.name}</Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Type</Typography>
                <Typography variant="body1" fontWeight="bold">{animal.animal_type}</Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Weight</Typography>
                <Typography variant="body1" fontWeight="bold">{animal.weight} kg</Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Food per Meal</Typography>
                <Typography variant="body1" fontWeight="bold">{animal.food_portion} kg</Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Current Food Level</Typography>
                <Typography variant="body1" fontWeight="bold" color={animal.food_level < 1.5 ? 'warning.main' : 'success.main'}>
                  {animal.food_level} kg
                </Typography>
              </Box>
              
              {/* Manual Feeding Button */}
              <Button
                variant="contained"
                color="primary"
                fullWidth
                startIcon={manualFeeding ? <CircularProgress size={20} /> : <RestaurantIcon />}
                onClick={() => {
                  setManualFeedingAmount(animal.food_portion);
                  setShowManualDialog(true);
                }}
                disabled={manualFeeding}
                sx={{ mt: 2 }}
              >
                {manualFeeding ? 'Feeding...' : 'Feed Now'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Feeding Schedules */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  ⏰ Feeding Schedule
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setScheduleForm({ 
                      schedule_time: '08:00', 
                      food_amount: animal.food_portion 
                    });
                    setShowScheduleDialog(true);
                  }}
                >
                  Add Schedule
                </Button>
              </Box>

              {schedules.length === 0 ? (
                <Alert severity="info">
                  No feeding schedules set. Add one to enable automatic feeding.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {schedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <ScheduleIcon sx={{ mr: 1, fontSize: 20 }} color="primary" />
                              <strong>{schedule.schedule_time.slice(0, 5)}</strong>
                            </Box>
                          </TableCell>
                          <TableCell>{schedule.food_amount} kg</TableCell>
                          <TableCell>
                            <Chip 
                              label={schedule.is_active ? 'Active' : 'Inactive'}
                              color={schedule.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Feeding Logs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Recent Feeding History
              </Typography>

              {logs.length === 0 ? (
                <Alert severity="info">
                  No feeding history yet.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date & Time</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Remaining Food</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logs.slice(0, 10).map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {new Date(log.dispense_time).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={log.feeding_type}
                              color={log.feeding_type === 'manual' ? 'primary' : 'secondary'}
                              size="small"
                              icon={log.feeding_type === 'manual' ? <PlayArrowIcon /> : <ScheduleIcon />}
                            />
                          </TableCell>
                          <TableCell>{log.food_portion} kg</TableCell>
                          <TableCell>{log.remaining_food_level} kg</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onClose={() => setShowScheduleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Feeding Schedule</DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <TextField
              fullWidth
              label="Schedule Time"
              type="time"
              value={scheduleForm.schedule_time}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, schedule_time: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 3 }}
            />
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Quick presets:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
              {quickPresets.map((preset) => (
                <Chip
                  key={preset.label}
                  label={`${preset.label} (${preset.time})`}
                  onClick={() => setScheduleForm(prev => ({ ...prev, schedule_time: preset.time }))}
                  clickable
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
            
            <TextField
              fullWidth
              label="Food Amount (kg)"
              type="number"
              value={scheduleForm.food_amount}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, food_amount: parseFloat(e.target.value) }))}
              inputProps={{ step: 0.05, min: 0.05 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateSchedule} variant="contained">
            Create Schedule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Feeding Dialog */}
      <Dialog open={showManualDialog} onClose={() => setShowManualDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manual Feeding</DialogTitle>
        <DialogContent>
          <Box pt={1}>
            <Typography variant="body1" gutterBottom>
              Feed <strong>{animal.name}</strong> manually
            </Typography>
            <TextField
              fullWidth
              label="Food Amount (kg)"
              type="number"
              value={manualFeedingAmount}
              onChange={(e) => setManualFeedingAmount(parseFloat(e.target.value))}
              inputProps={{ step: 0.05, min: 0.05, max: animal.food_level }}
              helperText={`Available food: ${animal.food_level} kg`}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowManualDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleManualFeeding} 
            variant="contained" 
            color="primary"
            disabled={manualFeeding}
            startIcon={manualFeeding ? <CircularProgress size={20} /> : <RestaurantIcon />}
          >
            {manualFeeding ? 'Feeding...' : 'Start Feeding'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AnimalDetail;