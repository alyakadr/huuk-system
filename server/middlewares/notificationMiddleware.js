const notificationService = require('../services/notificationService');
const { emitToUser, emitToInternalStaff } = require('../utils/socketEmit');

// Middleware to send notifications after booking operations
const sendNotificationAfterBooking = async (operation, bookingData) => {
  try {
    switch (operation) {
      case 'create':
        await notificationService.createSystemNotification('appointment_created', {
          appointmentId: bookingData.id,
          customerId: bookingData.user_id,
          staffId: bookingData.staff_id,
          serviceName: bookingData.service_name,
          appointmentDate: bookingData.date,
          customerName: bookingData.customer_name
        });
        break;
        
      case 'update':
        await notificationService.createSystemNotification('appointment_updated', {
          appointmentId: bookingData.id,
          customerId: bookingData.user_id,
          staffId: bookingData.staff_id,
          serviceName: bookingData.service_name,
          appointmentDate: bookingData.date,
          customerName: bookingData.customer_name
        });
        break;
        
      case 'cancel':
        await notificationService.createSystemNotification('appointment_cancelled', {
          appointmentId: bookingData.id,
          customerId: bookingData.user_id,
          staffId: bookingData.staff_id,
          serviceName: bookingData.service_name,
          appointmentDate: bookingData.date,
          customerName: bookingData.customer_name
        });
        break;
        
      case 'reschedule':
        await notificationService.createSystemNotification('appointment_updated', {
          appointmentId: bookingData.id,
          customerId: bookingData.user_id,
          staffId: bookingData.staff_id,
          serviceName: bookingData.service_name,
          appointmentDate: bookingData.date,
          customerName: bookingData.customer_name
        });
        break;
        
      case 'complete':
        await notificationService.createNotification(
          bookingData.user_id,
          'appointment',
          'Appointment Completed',
          `Your appointment for ${bookingData.service_name} has been completed. Please consider leaving a review.`,
          { priority: 'low', metadata: { appointmentId: bookingData.id } }
        );
        break;
        
      case 'absent':
        await notificationService.createNotification(
          bookingData.user_id,
          'appointment',
          'Appointment Missed',
          `You were marked as absent for your appointment on ${bookingData.date}. Please contact us for rescheduling.`,
          { priority: 'high', metadata: { appointmentId: bookingData.id } }
        );
        break;
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

// Middleware to send notifications after customer operations
const sendNotificationAfterCustomer = async (operation, customerData) => {
  try {
    switch (operation) {
      case 'register':
        await notificationService.createSystemNotification('new_customer', {
          customerId: customerData.id,
          customerName: customerData.fullname || customerData.username,
          email: customerData.email
        });
        break;
    }
  } catch (error) {
    console.error('Error sending customer notification:', error);
  }
};

// Middleware to send notifications after staff operations
const sendNotificationAfterStaff = async (operation, staffData) => {
  try {
    switch (operation) {
      case 'add':
        await notificationService.createSystemNotification('staff_added', {
          staffId: staffData.id,
          staffName: staffData.fullname || staffData.username,
          role: staffData.role
        });
        break;
    }
  } catch (error) {
    console.error('Error sending staff notification:', error);
  }
};

// Middleware to send real-time notifications
const sendRealTimeNotification = async (userId, notification) => {
  try {
    // If using Socket.IO, emit the notification
    if (global.io) {
      emitToUser(global.io, userId, 'notification', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        created_at: notification.created_at,
        isRead: false
      });
      
      // Emit bookingUpdated event for appointment-related notifications
      if (notification.type === 'appointment') {
        const bookingUpdatedPayload = {
          userId: userId,
          notificationType: notification.type,
          timestamp: new Date()
        };
        emitToUser(global.io, userId, 'bookingUpdated', bookingUpdatedPayload);
        emitToInternalStaff(global.io, 'bookingUpdated', bookingUpdatedPayload);
      }
    }
  } catch (error) {
    console.error('Error sending real-time notification:', error);
  }
};

// General notification creator with real-time support
const createAndSendNotification = async (userId, type, title, message, options = {}) => {
  try {
    const notificationId = await notificationService.createNotification(
      userId,
      type,
      title,
      message,
      options
    );
    
    // Send real-time notification
    await sendRealTimeNotification(userId, {
      id: notificationId,
      type,
      title,
      message,
      priority: options.priority || 'medium',
      created_at: new Date(),
      isRead: false
    });
    
    return notificationId;
  } catch (error) {
    console.error('Error creating and sending notification:', error);
    throw error;
  }
};

module.exports = {
  sendNotificationAfterBooking,
  sendNotificationAfterCustomer,
  sendNotificationAfterStaff,
  sendRealTimeNotification,
  createAndSendNotification
};
