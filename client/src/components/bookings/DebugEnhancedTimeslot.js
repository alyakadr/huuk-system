import React, { useState, useEffect } from 'react';
import { Button, Typography, Box, Paper, Grid, Alert, Chip } from '@mui/material';
import EnhancedTimeSlotDropdown from './EnhancedTimeSlotDropdown';

const DebugEnhancedTimeslot = () => {
  const [selectedTime, setSelectedTime] = useState('');
  const [logs, setLogs] = useState([]);
  const [mockAvailableSlots, setMockAvailableSlots] = useState([]);
  const [mockBookedSlots, setMockBookedSlots] = useState([]);
  const [mockError, setMockError] = useState(null);

  // Mock data scenarios
  const scenarios = {
    normal: {
      available: ['09:00', '09:30', '10:00', '11:00', '11:30', '14:00', '14:30', '15:00', '16:00', '16:30'],
      booked: ['10:30', '12:00', '12:30', '13:00', '13:30', '15:30', '17:00']
    },
    limited: {
      available: ['10:00', '14:00', '15:00'],
      booked: ['09:00', '09:30', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:30', '15:30', '16:00', '16:30', '17:00']
    },
    empty: {
      available: [],
      booked: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
    },
    allAvailable: {
      available: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'],
      booked: []
    }
  };

  // Add log entry
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Initialize with normal scenario
  useEffect(() => {
    setMockAvailableSlots(scenarios.normal.available);
    setMockBookedSlots(scenarios.normal.booked);
    addLog('🚀 Initialized with normal scenario');
  }, []);

  // Handle time selection
  const handleTimeChange = (time) => {
    setSelectedTime(time);
    addLog(`⏰ Time selected: ${time}`);
    
    // Simulate removing selected time from available slots (original buggy behavior)
    if (time && mockAvailableSlots.includes(time)) {
      // This demonstrates the bug where selected time disappears
      // setMockAvailableSlots(prev => prev.filter(slot => slot !== time));
      // addLog(`🔄 Removed ${time} from available slots (simulating original bug)`);
    }
  };

  // Load scenario
  const loadScenario = (scenarioName) => {
    const scenario = scenarios[scenarioName];
    setMockAvailableSlots(scenario.available);
    setMockBookedSlots(scenario.booked);
    setSelectedTime('');
    setMockError(null);
    addLog(`📋 Loaded scenario: ${scenarioName}`);
  };

  // Simulate error
  const simulateError = () => {
    setMockError('Failed to load time slots. Please try again.');
    addLog('❌ Simulated error condition');
  };

  // Clear error
  const clearError = () => {
    setMockError(null);
    addLog('✅ Cleared error condition');
  };

  // Reset to selected time
  const resetToSelectedTime = () => {
    if (selectedTime && !mockAvailableSlots.includes(selectedTime)) {
      setMockAvailableSlots(prev => [...prev, selectedTime].sort());
      addLog(`🔄 Reset ${selectedTime} back to available slots`);
    }
  };

  // Test rapid clicking
  const testRapidClicking = () => {
    addLog('🧪 Testing rapid clicking...');
    const testTimes = ['10:00', '11:00', '14:00', '15:00'];
    
    testTimes.forEach((time, index) => {
      setTimeout(() => {
        if (mockAvailableSlots.includes(time)) {
          handleTimeChange(time);
        }
      }, index * 100);
    });
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Debug: Enhanced Time Slot Dropdown
      </Typography>
      
      <Grid container spacing={3}>
        {/* Controls */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant="h6" gutterBottom>
              Test Scenarios
            </Typography>
            
            <Box sx={{ marginBottom: 2 }}>
              {Object.keys(scenarios).map((scenarioName) => (
                <Button
                  key={scenarioName}
                  variant="outlined"
                  onClick={() => loadScenario(scenarioName)}
                  sx={{ marginRight: 1, marginBottom: 1 }}
                  size="small"
                >
                  {scenarioName}
                </Button>
              ))}
            </Box>
            
            <Box sx={{ marginBottom: 2 }}>
              <Button
                variant="outlined"
                onClick={simulateError}
                color="error"
                sx={{ marginRight: 1 }}
                size="small"
              >
                Simulate Error
              </Button>
              <Button
                variant="outlined"
                onClick={clearError}
                color="success"
                sx={{ marginRight: 1 }}
                size="small"
              >
                Clear Error
              </Button>
              <Button
                variant="outlined"
                onClick={resetToSelectedTime}
                color="info"
                sx={{ marginRight: 1 }}
                size="small"
              >
                Reset Selected
              </Button>
              <Button
                variant="outlined"
                onClick={testRapidClicking}
                color="warning"
                size="small"
              >
                Test Rapid Clicks
              </Button>
            </Box>

            {mockError && (
              <Alert severity="error" sx={{ marginBottom: 2 }}>
                {mockError}
              </Alert>
            )}
            
            <Box sx={{ marginBottom: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Enhanced Time Slot Dropdown
              </Typography>
              <EnhancedTimeSlotDropdown
                availableSlots={mockAvailableSlots}
                bookedSlots={mockBookedSlots}
                selectedTime={selectedTime}
                onChange={handleTimeChange}
                error={mockError}
                disabled={false}
                placeholder="Select a time slot..."
              />
            </Box>
          </Paper>
        </Grid>

        {/* State Display */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant="h6" gutterBottom>
              Current State
            </Typography>
            
            <Box sx={{ marginBottom: 2 }}>
              <Typography variant="body2" component="div">
                <strong>Selected Time:</strong> {selectedTime || 'None'}
              </Typography>
              <Typography variant="body2" component="div">
                <strong>Available Slots Count:</strong> {mockAvailableSlots.length}
              </Typography>
              <Typography variant="body2" component="div">
                <strong>Booked Slots Count:</strong> {mockBookedSlots.length}
              </Typography>
              <Typography variant="body2" component="div">
                <strong>Error State:</strong> {mockError ? 'Yes' : 'No'}
              </Typography>
            </Box>

            <Box sx={{ marginBottom: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Available Slots:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {mockAvailableSlots.map((slot) => (
                  <Chip
                    key={slot}
                    label={slot}
                    color={slot === selectedTime ? 'primary' : 'default'}
                    size="small"
                    variant={slot === selectedTime ? 'filled' : 'outlined'}
                  />
                ))}
                {mockAvailableSlots.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No available slots
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ marginBottom: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Booked Slots:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {mockBookedSlots.map((slot) => (
                  <Chip
                    key={slot}
                    label={slot}
                    color="error"
                    size="small"
                    variant="outlined"
                  />
                ))}
                {mockBookedSlots.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No booked slots
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Debug Logs */}
        <Grid item xs={12}>
          <Paper sx={{ padding: 2 }}>
            <Typography variant="h6" gutterBottom>
              Debug Logs
            </Typography>
            <Box 
              sx={{ 
                height: 300, 
                overflow: 'auto', 
                backgroundColor: '#f5f5f5', 
                padding: 1,
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.8rem'
              }}
            >
              {logs.map((log, index) => (
                <div key={index}>{log}</div>
              ))}
            </Box>
            <Button 
              variant="outlined" 
              onClick={() => setLogs([])}
              sx={{ marginTop: 1 }}
              size="small"
            >
              Clear Logs
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DebugEnhancedTimeslot;
