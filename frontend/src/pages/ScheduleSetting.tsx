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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { apiService, Animal, FeedingSchedule } from '../services/apiService.ts';

const ScheduleSetting: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState({
    animal_id: '',
    container_id: '',
    schedule_time: '08:00',
    food_amount: 0.2,
  });

  // Data state
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [schedules, setSchedules] = useState<FeedingSchedule[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-populate container_id when animal is selected
    if (field === 'animal_id') {
      const selectedAnimal = animals.find(animal => animal.id === parseInt(value));
      if (selectedAnimal) {
        setFormData(prev => ({
          ...prev,
          container_id: selectedAnimal.container_id.toString(),
          food_amount: selectedAnimal.food_portion, // Use animal's default portion
        }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert time format from HH:MM to HH:MM:SS
      const timeWithSeconds = formData.schedule_time + ':00';
      
      const scheduleData = {
        animal_id: parseInt(formData.animal_id),
        container_id: parseInt(formData.container_id),
        schedule_time: timeWithSeconds,
        food_amount: formData.food_amount,
      };

      const response = await apiService.createSchedule(scheduleData);
      
      if ((response as any).success) {
        const selectedAnimal = animals.find(a => a.id === parseInt(formData.animal_id));
        setSuccess(`✅ Feeding schedule created for ${selectedAnimal?.name} at ${formData.schedule_time}`);
        
        // Reset form
        setFormData({
          animal_id: '',
          container_id: '',
          schedule_time: '08:00',
          food_amount: 0.2,
        });
        
        // Refresh schedules
        fetchSchedules();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
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

  const fetchSchedules = async () => {
    try {
      const response = await apiService.getAllSchedules();
      setSchedules((response as any).schedules || []);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  useEffect(() => {
    fetchAnimals();
    fetchSchedules();
  }, []);

  // Quick schedule presets
  const quickPresets = [
    { label: 'Morning', time: '08:00' },
    { label: 'Noon', time: '12:00' },
    { label: 'Evening', time: '18:00' },
    { label: 'Night', time: '22:00' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        ⏰ Schedule Setting
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Set up automatic feeding schedules for your pets.
      </Typography>

      <Grid container spacing={3} mt={1}>
        {/* Schedule Creation Form */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📅 Create New Schedule
              </Typography>

              {animals.length === 0 ? (
                <Alert severity="warning">
                  No animals registered. Please bind pets first using Pet Binding.
                </Alert>
              ) : (
                <form onSubmit={handleSubmit}>
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <FormControl fullWidth required>
                        <InputLabel>Select Pet</InputLabel>
                        <Select
                          value={formData.animal_id}
                          label="Select Pet"
                          onChange={(e) => handleInputChange('animal_id', e.target.value)}
                        >
                          {animals.map((animal) => (
                            <MenuItem key={animal.id} value={animal.id}>
                              {animal.name} ({animal.animal_type}) - Container {animal.container_id}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Container ID"
                        type="number"
                        value={formData.container_id}
                        disabled
                        helperText="Auto-populated from selected pet"
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Food Amount (kg)"
                        type="number"
                        value={formData.food_amount}
                        onChange={(e) => handleInputChange('food_amount', parseFloat(e.target.value))}
                        inputProps={{ step: 0.05, min: 0.05 }}
                        required
                        helperText="Amount of food to dispense"
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Schedule Time"
                        type="time"
                        value={formData.schedule_time}
                        onChange={(e) => handleInputChange('schedule_time', e.target.value)}
                        InputLabelProps={{
                          shrink: true,
                        }}
                        required
                        helperText="Time to automatically feed (24-hour format)"
                      />
                    </Grid>

                    {/* Quick Time Presets */}
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Quick presets:
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {quickPresets.map((preset) => (
                          <Chip
                            key={preset.label}
                            label={`${preset.label} (${preset.time})`}
                            onClick={() => handleInputChange('schedule_time', preset.time)}
                            clickable
                            variant="outlined"
                            size="small"
                          />
                        ))}
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading || !formData.animal_id}
                        startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                        fullWidth
                      >
                        {loading ? 'Creating Schedule...' : 'Create Feeding Schedule'}
                      </Button>
                    </Grid>
                  </Grid>
                </form>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Current Schedules */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📋 Current Schedules
              </Typography>

              {schedules.length === 0 ? (
                <Alert severity="info">
                  No feeding schedules configured yet.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Pet</TableCell>
                        <TableCell>Time</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {schedules.map((schedule) => (
                        <TableRow key={schedule.id}>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {schedule.animal_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Container {schedule.container_id}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {schedule.schedule_time.slice(0, 5)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {schedule.food_amount}kg
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={schedule.is_active ? 'Active' : 'Inactive'}
                              color={schedule.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => {
                                // Note: Delete functionality would need to be implemented in the backend
                                setError('Delete functionality not implemented yet');
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
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

        {/* Schedule Overview */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📊 Daily Schedule Overview
              </Typography>
              
              {schedules.length === 0 ? (
                <Alert severity="info">
                  Create your first feeding schedule above to see the daily overview.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {schedules
                    .sort((a, b) => a.schedule_time.localeCompare(b.schedule_time))
                    .map((schedule) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={schedule.id}>
                        <Paper elevation={1} sx={{ p: 2, textAlign: 'center' }}>
                          <ScheduleIcon color="primary" sx={{ mb: 1 }} />
                          <Typography variant="h6" color="primary">
                            {schedule.schedule_time.slice(0, 5)}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {schedule.animal_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {schedule.food_amount}kg food
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                </Grid>
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
    </Box>
  );
};

export default ScheduleSetting;