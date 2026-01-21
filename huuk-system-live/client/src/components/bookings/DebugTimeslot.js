import React, { useState, useEffect } from 'react';
import { Button, Typography, Box, Paper, Grid, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

const DebugTimeslot = () => {
  const [persistedData, setPersistedData] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [clientName, setClientName] = useState('');
  const [logs, setLogs] = useState([]);
  const [timeSlots] = useState([
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
  ]);

  // Load persisted data from localStorage
  const loadPersistedData = () => {
    try {
      const savedData = localStorage.getItem('huuk_booking_form_data');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        console.log('📦 [DEBUG] Loaded persisted data:', parsedData);
        return parsedData;
      }
    } catch (error) {
      console.error('❌ [DEBUG] Error loading persisted data:', error);
    }
    return null;
  };

  // Save data to localStorage
  const saveDataToLocalStorage = (data) => {
    try {
      localStorage.setItem('huuk_booking_form_data', JSON.stringify(data));
      console.log('💾 [DEBUG] Saved data to localStorage:', data);
      addLog(`💾 Saved to localStorage: ${JSON.stringify(data)}`);
    } catch (error) {
      console.error('❌ [DEBUG] Error saving data to localStorage:', error);
      addLog(`❌ Error saving to localStorage: ${error.message}`);
    }
  };

  // Add log entry
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Load persisted data on component mount
  useEffect(() => {
    const data = loadPersistedData();
    if (data) {
      setPersistedData(data);
      setSelectedTime(data.time || '');
      setClientName(data.clientName || '');
      addLog(`🔄 Restored from localStorage: Time=${data.time}, ClientName=${data.clientName}`);
    } else {
      addLog('📦 No persisted data found');
    }
  }, []);

  // Handle time selection
  const handleTimeChange = (event) => {
    const newTime = event.target.value;
    setSelectedTime(newTime);
    addLog(`⏰ Time selected: ${newTime}`);
    
    // Save to localStorage
    const formData = {
      ...persistedData,
      time: newTime,
      clientName: clientName,
      timestamp: new Date().toISOString()
    };
    saveDataToLocalStorage(formData);
    setPersistedData(formData);
  };

  // Handle client name change
  const handleClientNameChange = (event) => {
    const newName = event.target.value;
    setClientName(newName);
    addLog(`👤 Client name changed: ${newName}`);
    
    // Save to localStorage
    const formData = {
      ...persistedData,
      time: selectedTime,
      clientName: newName,
      timestamp: new Date().toISOString()
    };
    saveDataToLocalStorage(formData);
    setPersistedData(formData);
  };

  // Clear localStorage
  const clearLocalStorage = () => {
    localStorage.removeItem('huuk_booking_form_data');
    setPersistedData(null);
    setSelectedTime('');
    setClientName('');
    addLog('🧹 Cleared localStorage');
  };

  // Refresh data
  const refreshData = () => {
    const data = loadPersistedData();
    setPersistedData(data);
    if (data) {
      setSelectedTime(data.time || '');
      setClientName(data.clientName || '');
      addLog('🔄 Refreshed data from localStorage');
    }
  };

  // Test persistence
  const testPersistence = () => {
    addLog('🧪 Testing persistence...');
    
    // Save test data
    const testData = {
      time: '14:30',
      clientName: 'Test User',
      timestamp: new Date().toISOString()
    };
    saveDataToLocalStorage(testData);
    
    // Load it back
    const loadedData = loadPersistedData();
    
    if (loadedData && loadedData.time === testData.time && loadedData.clientName === testData.clientName) {
      addLog('✅ Persistence test passed!');
    } else {
      addLog('❌ Persistence test failed!');
    }
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Debug: Time Slot Selection & Persistence
      </Typography>
      
      <Grid container spacing={3}>
        {/* Controls */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant="h6" gutterBottom>
              Booking Form Controls
            </Typography>
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Time</InputLabel>
              <Select
                value={selectedTime}
                onChange={handleTimeChange}
                label="Select Time"
              >
                {timeSlots.map((time) => (
                  <MenuItem key={time} value={time}>
                    {time}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth margin="normal">
              <input
                type="text"
                value={clientName}
                onChange={handleClientNameChange}
                placeholder="Client Name"
                disabled={!selectedTime}
                style={{
                  padding: '12px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: !selectedTime ? '#f5f5f5' : '#ffffff'
                }}
              />
            </FormControl>
            
            <Box sx={{ marginTop: 2 }}>
              <Button 
                variant="contained" 
                onClick={clearLocalStorage}
                sx={{ marginRight: 1 }}
              >
                Clear Storage
              </Button>
              <Button 
                variant="outlined" 
                onClick={refreshData}
                sx={{ marginRight: 1 }}
              >
                Refresh
              </Button>
              <Button 
                variant="outlined" 
                onClick={testPersistence}
                color="secondary"
              >
                Test Persistence
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* State Display */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant="h6" gutterBottom>
              Current State
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Selected Time:</strong> {selectedTime || 'None'}
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Client Name:</strong> {clientName || 'None'}
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Client Name Input Enabled:</strong> {selectedTime ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="body2" component="div">
              <strong>Persisted Data:</strong> {persistedData ? 'Yes' : 'No'}
            </Typography>
            {persistedData && (
              <Box sx={{ marginTop: 1, padding: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="caption" component="pre">
                  {JSON.stringify(persistedData, null, 2)}
                </Typography>
              </Box>
            )}
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

export default DebugTimeslot;
