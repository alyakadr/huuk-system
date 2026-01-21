import React, { useState, useEffect } from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { TextField, Box, Button } from '@mui/material';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';

function DatePickerTest() {
  const [selectedDate, setSelectedDate] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  console.log('DatePicker Test component rendered');
  console.log('Current selected date:', selectedDate);
  
  // Check if MUI X DatePicker components are available
  console.log('DatePicker component:', DatePicker);
  console.log('StaticDatePicker component:', StaticDatePicker);
  console.log('LocalizationProvider component:', LocalizationProvider);
  console.log('AdapterDateFns component:', AdapterDateFns);
  
  useEffect(() => {
    // Check for DatePicker-related DOM elements
    const checkElements = () => {
      console.log('Checking for DatePicker elements in DOM...');
      console.log('MuiPickersPopper elements:', document.querySelectorAll('.MuiPickersPopper-root'));
      console.log('DatePicker elements:', document.querySelectorAll('[data-testid="DatePicker"]'));
      console.log('Calendar elements:', document.querySelectorAll('.MuiDateCalendar-root'));
    };
    
    // Check immediately and after a delay
    checkElements();
    setTimeout(checkElements, 1000);
  }, [isOpen]);

  return (
    <div style={{ padding: '20px', border: '2px solid red' }}>
      <h2>Date Picker Test</h2>
      <p>This is a test component for DatePicker</p>
      
      {/* Test 1: Basic TextField to ensure MUI is working */}
      <TextField 
        label="Test TextField" 
        variant="outlined" 
        style={{ marginBottom: '20px' }}
        onChange={(e) => console.log('TextField value:', e.target.value)}
      />
      
      {/* Test 2: DatePicker with controlled open state */}
      <div style={{ marginTop: '20px' }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Test Date Picker (Controlled)"
            value={selectedDate}
            onChange={(date) => {
              console.log('Date changed:', date);
              setSelectedDate(date);
            }}
            open={isOpen}
            onOpen={() => setIsOpen(true)}
            onClose={() => setIsOpen(false)}
            slotProps={{
              textField: {
                variant: "outlined",
                fullWidth: true,
                onClick: () => setIsOpen(true),
              },
            }}
          />
        </LocalizationProvider>
        <Button 
          onClick={() => setIsOpen(!isOpen)}
          variant="contained"
          style={{ marginLeft: '10px' }}
        >
          Toggle Calendar
        </Button>
      </div>
      
      {/* Test 3: DatePicker with readOnly input */}
      <div style={{ marginTop: '20px' }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Test Date Picker (ReadOnly)"
            value={selectedDate}
            onChange={(date) => {
              console.log('Date changed (readonly):', date);
              setSelectedDate(date);
            }}
            slotProps={{
              textField: {
                variant: "outlined",
                fullWidth: true,
                InputProps: {
                  readOnly: true,
                },
              },
            }}
          />
        </LocalizationProvider>
      </div>
      
      {/* Test 4: DatePicker with no input restrictions */}
      <div style={{ marginTop: '20px' }}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Test Date Picker (No Restrictions)"
            value={selectedDate}
            onChange={(date) => {
              console.log('Date changed (no restrictions):', date);
              setSelectedDate(date);
            }}
            disablePast={false}
            slotProps={{
              textField: {
                variant: "outlined",
                fullWidth: true,
              },
            }}
          />
        </LocalizationProvider>
      </div>
      
      <p>Selected date: {selectedDate ? selectedDate.toString() : 'None'}</p>
      <p>Calendar is open: {isOpen ? 'Yes' : 'No'}</p>
      
      {/* Test 5: StaticDatePicker - Always visible calendar */}
      <div style={{ marginTop: '20px' }}>
        <h3>StaticDatePicker (Always visible calendar)</h3>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <StaticDatePicker
            value={selectedDate}
            onChange={(date) => {
              console.log('StaticDatePicker date changed:', date);
              setSelectedDate(date);
            }}
            slotProps={{
              actionBar: {
                actions: ['today', 'clear', 'accept'],
              },
            }}
          />
        </LocalizationProvider>
      </div>
      
      {/* Test 6: Basic date input */}
      <div style={{ marginTop: '20px' }}>
        <label>Basic HTML date input:</label>
        <input 
          type="date" 
          onChange={(e) => console.log('HTML date input:', e.target.value)}
          style={{ marginLeft: '10px' }}
        />
      </div>
    </div>
  );
}

export default DatePickerTest;
