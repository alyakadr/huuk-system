import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import EnhancedTimeSlotDropdown from '../components/bookings/EnhancedTimeSlotDropdown';

const TimeSlotDebugger = () => {
  const [selectedTime, setSelectedTime] = useState('');
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState('');
  const [debugLog, setDebugLog] = useState([]);

  // Mock time slots for testing
  const mockTimeSlots = [
    '09:00:00',
    '09:30:00',
    '10:00:00',
    '10:30:00',
    '11:00:00',
    '11:30:00',
    '14:00:00',
    '14:30:00',
    '15:00:00',
    '15:30:00',
    '16:00:00',
    '16:30:00',
    '17:00:00',
    '17:30:00',
    '18:00:00',
    '18:30:00',
    '19:00:00',
    '19:30:00'
  ];

  const addToDebugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleTimeChange = (newTime) => {
    addToDebugLog(`Time changed: ${newTime}`);
    setSelectedTime(newTime);
  };

  const handleTimeSlotSelected = (slot) => {
    addToDebugLog(`Time slot selected callback: ${slot}`);
    // Remove the selected slot from available slots
    setTimeSlots(prev => prev.filter(s => s !== slot));
  };

  const loadMockTimeSlots = () => {
    setLoading(true);
    addToDebugLog('Loading mock time slots...');
    
    setTimeout(() => {
      setTimeSlots(mockTimeSlots);
      setLoading(false);
      addToDebugLog(`Loaded ${mockTimeSlots.length} time slots`);
    }, 1000);
  };

  const resetTest = () => {
    setSelectedTime('');
    setTimeSlots([]);
    setErrors('');
    setDebugLog([]);
    addToDebugLog('Test reset');
  };

  const simulateError = () => {
    setErrors('Unable to load time slots');
    addToDebugLog('Error simulated');
  };

  const testArrayIssue = () => {
    // Test with non-array data
    setTimeSlots('not an array');
    addToDebugLog('Set timeSlots to non-array value');
  };

  useEffect(() => {
    addToDebugLog('TimeSlotDebugger mounted');
  }, []);

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Time Slot Debugger
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test Controls
        </Typography>
        <Button variant="contained" onClick={loadMockTimeSlots} sx={{ mr: 1 }}>
          Load Mock Time Slots
        </Button>
        <Button variant="outlined" onClick={resetTest} sx={{ mr: 1 }}>
          Reset Test
        </Button>
        <Button variant="outlined" onClick={simulateError} sx={{ mr: 1 }}>
          Simulate Error
        </Button>
        <Button variant="outlined" onClick={testArrayIssue} sx={{ mr: 1 }}>
          Test Array Issue
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current State
        </Typography>
        <Typography variant="body2">
          Selected Time: {selectedTime || 'None'}
        </Typography>
        <Typography variant="body2">
          Available Slots: {Array.isArray(timeSlots) ? timeSlots.length : 'Not an array'}
        </Typography>
        <Typography variant="body2">
          Loading: {loading ? 'Yes' : 'No'}
        </Typography>
        <Typography variant="body2">
          Errors: {errors || 'None'}
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Time Slot Component
        </Typography>
        <EnhancedTimeSlotDropdown
          value={selectedTime}
          onChange={handleTimeChange}
          disabled={false}
          timeSlots={timeSlots}
          loading={loading}
          errors={errors}
          timeSlotBookingCounts={{
            '09:00:00': 8,
            '14:00:00': 6,
            '18:00:00': 7
          }}
          onTimeSlotSelected={handleTimeSlotSelected}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Debug Log
        </Typography>
        <Box sx={{ 
          maxHeight: 200, 
          overflow: 'auto', 
          bgcolor: '#f5f5f5', 
          p: 2, 
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.8rem'
        }}>
          {debugLog.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </Box>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Raw Data
        </Typography>
        <pre style={{ fontSize: '0.8rem', overflow: 'auto' }}>
          {JSON.stringify({
            selectedTime,
            timeSlots,
            loading,
            errors,
            timeSlotsType: typeof timeSlots,
            timeSlotsIsArray: Array.isArray(timeSlots)
          }, null, 2)}
        </pre>
      </Box>

      {errors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors}
        </Alert>
      )}
    </Box>
  );
};

export default TimeSlotDebugger;
