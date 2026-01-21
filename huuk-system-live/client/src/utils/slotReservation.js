import client from '../api/client';

// Reserve a time slot temporarily
export const reserveSlot = async (outlet_id, service_id, staff_id, date, time) => {
  try {
    const response = await client.post('/bookings/reserve-slot', {
      outlet_id,
      service_id,
      staff_id,
      date,
      time
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error reserving slot:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to reserve slot'
    };
  }
};

// Release a reserved time slot
export const releaseSlot = async (reservationId) => {
  try {
    const response = await client.post('/bookings/release-slot', {
      reservation_id: reservationId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error releasing slot:', error);
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to release slot'
    };
  }
};

// Check if a slot is available
export const checkSlotAvailability = async (outlet_id, service_id, staff_id, date, time) => {
  try {
    const response = await client.get('/bookings/check-slot-availability', {
      params: {
        outlet_id,
        service_id,
        staff_id,
        date,
        time
      }
    });
    return {
      success: true,
      available: response.data.available
    };
  } catch (error) {
    console.error('Error checking slot availability:', error);
    return {
      success: false,
      available: false,
      error: error.response?.data?.message || 'Failed to check slot availability'
    };
  }
};

// Manage slot reservations in a React component
export class SlotReservationManager {
  constructor() {
    this.currentReservation = null;
    this.reservationTimer = null;
  }

  // Reserve a slot and set up auto-cleanup
  async reserveSlot(outlet_id, service_id, staff_id, date, time) {
    // Check if user is logged in before attempting to reserve
    const token = localStorage.getItem("token");
    if (!token) {
      console.log('⚠️ User not logged in, skipping slot reservation');
      return {
        success: false,
        error: 'User not logged in - slot reservation skipped'
      };
    }

    // Release any existing reservation first
    await this.releaseCurrentReservation();

    const result = await reserveSlot(outlet_id, service_id, staff_id, date, time);
    
    if (result.success) {
      this.currentReservation = {
        reservationId: result.data.reservationId,
        outlet_id,
        service_id,
        staff_id,
        date,
        time,
        expiresAt: new Date(result.data.expiresAt)
      };

      // Set up auto-cleanup 1 minute before expiry
      const cleanupTime = new Date(this.currentReservation.expiresAt).getTime() - 60000;
      const now = Date.now();
      
      if (cleanupTime > now) {
        this.reservationTimer = setTimeout(() => {
          this.releaseCurrentReservation();
        }, cleanupTime - now);
      }

      console.log(`Slot reserved until ${this.currentReservation.expiresAt.toLocaleTimeString()}`);
    }

    return result;
  }

  // Release current reservation
  async releaseCurrentReservation() {
    if (this.currentReservation) {
      if (this.reservationTimer) {
        clearTimeout(this.reservationTimer);
        this.reservationTimer = null;
      }

      await releaseSlot(this.currentReservation.reservationId);
      console.log('Slot reservation released');
      this.currentReservation = null;
    }
  }

  // Get current reservation info
  getCurrentReservation() {
    return this.currentReservation;
  }

  // Check if current reservation is expired
  isReservationExpired() {
    if (!this.currentReservation) return true;
    return Date.now() > this.currentReservation.expiresAt.getTime();
  }

  // Get time remaining on current reservation
  getTimeRemaining() {
    if (!this.currentReservation) return 0;
    return Math.max(0, this.currentReservation.expiresAt.getTime() - Date.now());
  }

  // Cleanup method - call this when component unmounts
  cleanup() {
    this.releaseCurrentReservation();
  }
}
