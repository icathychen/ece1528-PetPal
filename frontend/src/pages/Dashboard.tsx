import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  Chip,
  LinearProgress,
  IconButton,
  Button,
  Container,
  CardActionArea,
  Fab,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PetsIcon from '@mui/icons-material/Pets';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AddIcon from '@mui/icons-material/Add';
import { apiService, Animal, FeedingSchedule } from '../services/apiService.ts';

interface DashboardProps {
  onAnimalSelect: (animalId: number) => void;
  onShowBinding: () => void;
}

interface DashboardStats {
  total_feedings: number;
  scheduled_feedings: number;
  manual_feedings: number;
  total_food_dispensed: string;
  last_feeding: string | null;
  active_containers: number;
}

const Dashboard: React.FC<DashboardProps> = ({ onAnimalSelect, onShowBinding }) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [schedules, setSchedules] = useState<FeedingSchedule[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [animalsRes, schedulesRes, statsRes] = await Promise.all([
        apiService.getAllPets(),
        apiService.getAllSchedules(),
        apiService.getFeedingStats(),
      ]);

      setAnimals((animalsRes as any).animals || []);
      setSchedules((schedulesRes as any).schedules || []);
      setStats((statsRes as any).stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          📊 Dashboard
        </Typography>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Loading dashboard data...
        </Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          � My Pets Dashboard
        </Typography>
        <Box display="flex" gap={2}>
          <IconButton onClick={fetchDashboardData} color="primary">
            <RefreshIcon />
          </IconButton>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={onShowBinding}
          >
            Add New Pet
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* System Overview */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <PetsIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Active Pets</Typography>
              </Box>
              <Typography variant="h3" color="primary">
                {animals.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Registered animals
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ScheduleIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6">Schedules</Typography>
              </Box>
              <Typography variant="h3" color="secondary">
                {schedules.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active feeding schedules
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <RestaurantIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Total Feedings</Typography>
              </Box>
              <Typography variant="h3" color="success.main">
                {stats?.total_feedings || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All time feedings
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <TrendingUpIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Food Dispensed</Typography>
              </Box>
              <Typography variant="h3" color="warning.main">
                {stats?.total_food_dispensed || '0.00'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                kg total dispensed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Animals Overview */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                🐾 Registered Animals
              </Typography>
              {animals.length === 0 ? (
                <Alert severity="info">
                  No animals registered yet. Use Pet Binding to add your first pet!
                </Alert>
              ) : (
                <Box>
                  {animals.map((animal) => (
                    <Box key={animal.id} display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {animal.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {animal.animal_type} • Container {animal.container_id} • {animal.weight}kg
                        </Typography>
                      </Box>
                      <Box>
                        <Chip 
                          label={`${animal.food_level}kg food`}
                          color={animal.food_level < 1.5 ? 'warning' : 'success'}
                          size="small"
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                📈 Feeding Statistics
              </Typography>
              {stats ? (
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Scheduled Feedings:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.scheduled_feedings}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Manual Feedings:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.manual_feedings}
                    </Typography>
                  </Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Active Containers:</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {stats.active_containers}
                    </Typography>
                  </Box>
                  {stats.last_feeding && (
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Last Feeding:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {new Date(stats.last_feeding).toLocaleString()}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Alert severity="info">
                  No feeding statistics available yet.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Schedules */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                ⏰ Today's Feeding Schedule
              </Typography>
              {schedules.length === 0 ? (
                <Alert severity="info">
                  No feeding schedules configured. Use Schedule Setting to create feeding times!
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {schedules.map((schedule) => (
                    <Grid item xs={12} sm={6} md={4} key={schedule.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {schedule.animal_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Container {schedule.container_id}
                          </Typography>
                          <Typography variant="h6" color="primary" mt={1}>
                            {schedule.schedule_time}
                          </Typography>
                          <Typography variant="body2">
                            {schedule.food_amount}kg food
                          </Typography>
                          <Chip 
                            label={schedule.is_active ? 'Active' : 'Inactive'}
                            color={schedule.is_active ? 'success' : 'default'}
                            size="small"
                            sx={{ mt: 1 }}
                          />
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Pet Cards - Main Feature */}
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom>
            🐾 Your Pets
          </Typography>
          {animals.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center' }}>
              <PetsIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No pets registered yet
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Add your first pet to start smart feeding
              </Typography>
              <Button 
                variant="contained" 
                size="large"
                startIcon={<AddIcon />}
                onClick={onShowBinding}
              >
                Add Your First Pet
              </Button>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {animals.map((animal) => (
                <Grid item xs={12} sm={6} md={4} key={animal.id}>
                  <Card sx={{ height: '100%' }}>
                    <CardActionArea 
                      sx={{ height: '100%', p: 2 }}
                      onClick={() => onAnimalSelect(animal.id)}
                    >
                      <Box display="flex" alignItems="center" mb={2}>
                        <PetsIcon color="primary" sx={{ mr: 1, fontSize: 30 }} />
                        <Typography variant="h6" fontWeight="bold">
                          {animal.name}
                        </Typography>
                      </Box>
                      
                      <Typography variant="body1" color="text.secondary" mb={1}>
                        {animal.animal_type} • {animal.weight}kg
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        Container {animal.container_id}
                      </Typography>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Chip 
                          label={`${animal.food_level}kg food`}
                          color={animal.food_level < 1.5 ? 'warning' : 'success'}
                          size="small"
                        />
                        <Chip 
                          label={`${animal.food_portion}kg/meal`}
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="caption" color="primary" sx={{ mt: 2, display: 'block' }}>
                        Click to manage →
                      </Typography>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>

      {/* Floating Action Button for mobile */}
      <Fab 
        color="primary" 
        aria-label="add pet"
        sx={{ 
          position: 'fixed', 
          bottom: 16, 
          right: 16,
          display: { xs: 'flex', sm: 'none' }
        }}
        onClick={onShowBinding}
      >
        <AddIcon />
      </Fab>
    </Container>
  );
};

export default Dashboard;