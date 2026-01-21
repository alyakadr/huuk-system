import React, { useState } from 'react';
import { Box, Typography, Button, MenuItem, Select, FormControl, Paper } from '@mui/material';

const SimpleClickTest = () => {
  const [selectedValue, setSelectedValue] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const testData = ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'];

  const handleClick = () => {
    setClickCount(prev => prev + 1);
    console.log('Button clicked! Count:', clickCount + 1);
  };

  const handleSelectChange = (event) => {
    setSelectedValue(event.target.value);
    console.log('Select changed to:', event.target.value);
  };

  const handleMenuItemClick = (value) => {
    console.log('Menu item clicked directly:', value);
    setSelectedValue(value);
    setDropdownOpen(false);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Simple Click Test
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. Basic Button Test
        </Typography>
        <Button 
          variant="contained" 
          onClick={handleClick}
          sx={{ mr: 2 }}
        >
          Click Me (Count: {clickCount})
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. Standard Select Test
        </Typography>
        <FormControl fullWidth sx={{ maxWidth: 200 }}>
          <Select
            value={selectedValue}
            onChange={handleSelectChange}
            displayEmpty
          >
            <MenuItem value="">
              <em>Select an option</em>
            </MenuItem>
            {testData.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Selected: {selectedValue || 'None'}
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          3. Manual Menu Test
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          sx={{ mb: 2 }}
        >
          Toggle Menu
        </Button>
        {dropdownOpen && (
          <Paper sx={{ p: 1, maxWidth: 200 }}>
            {testData.map((item) => (
              <MenuItem 
                key={item} 
                onClick={() => handleMenuItemClick(item)}
                sx={{ cursor: 'pointer' }}
              >
                {item}
              </MenuItem>
            ))}
          </Paper>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          4. Debug Info
        </Typography>
        <Typography variant="body2">
          Button clicks: {clickCount}
        </Typography>
        <Typography variant="body2">
          Selected value: {selectedValue}
        </Typography>
        <Typography variant="body2">
          Manual menu open: {dropdownOpen ? 'Yes' : 'No'}
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          5. Console Test
        </Typography>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            console.log('🔴 RED LOG - Console test button clicked');
            console.warn('🟡 YELLOW LOG - This is a warning');
            console.error('🔴 ERROR LOG - This is an error');
            alert('Console test - check your browser console!');
          }}
        >
          Console Test
        </Button>
      </Box>
    </Box>
  );
};

export default SimpleClickTest;
