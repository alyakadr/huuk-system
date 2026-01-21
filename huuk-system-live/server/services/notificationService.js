const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class NotificationService {
  constructor() {
    this.initializeDatabase();
  }

  // Initialize notification tables if they don't exist
  async initializeDatabase() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NULL,
          metadata JSON,
          INDEX idx_user_id (user_id),
          INDEX idx_type (type),
          INDEX idx_is_read (is_read),
          INDEX idx_created_at (created_at)
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS notification_settings (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          notification_type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          email_enabled BOOLEAN DEFAULT FALSE,
          push_enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_type (user_id, notification_type)
        )
      `);
    } catch (error) {
      console.error('Error initializing notification database:', error);
    }
  }

  // Create a new notification
  async createNotification(userId, type, title, message, options = {}) {
    try {
      const notificationId = uuidv4();
      const {
        priority = 'medium',
        expiresAt = null,
        metadata = null
      } = options;

      // Convert userId to string to handle both integer and string IDs
      const userIdString = userId ? userId.toString() : '1';

      await db.query(
        `INSERT INTO notifications (id, user_id, type, title, message, priority, expires_at, metadata) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [notificationId, userIdString, type, title, message, priority, expiresAt, JSON.stringify(metadata)]
      );

      return notificationId;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Get notifications for a user with role-based filtering
  async getNotificationsForUser(userId, userRole, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        unreadOnly = false,
        type = null
      } = options;

      let query = `
        SELECT n.*, u.role, u.username 
        FROM notifications n
        JOIN users u ON n.user_id = u.id
        WHERE n.user_id = ? AND (n.expires_at IS NULL OR n.expires_at > NOW())
      `;
      
      const params = [userId.toString()];

      // Role-based filtering
      if (userRole !== 'manager') {
        // Staff and customers see limited notification types
        const allowedTypes = userRole === 'staff' 
          ? ['appointment', 'customer', 'general', 'system']
          : ['appointment', 'general'];
        
        query += ` AND n.type IN (${allowedTypes.map(() => '?').join(',')})`;
        params.push(...allowedTypes);
      }

      if (unreadOnly) {
        query += ` AND n.is_read = FALSE`;
      }

      if (type) {
        query += ` AND n.type = ?`;
        params.push(type);
      }

      query += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  // Get unread count for a user
  async getUnreadCount(userId, userRole) {
    try {
      let query = `
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = ? AND is_read = FALSE AND (expires_at IS NULL OR expires_at > NOW())
      `;
      
      const params = [userId.toString()];

      // Role-based filtering for count
      if (userRole !== 'manager') {
        const allowedTypes = userRole === 'staff' 
          ? ['appointment', 'customer', 'general', 'system']
          : ['appointment', 'general'];
        
        query += ` AND type IN (${allowedTypes.map(() => '?').join(',')})`;
        params.push(...allowedTypes);
      }

      const [rows] = await db.query(query, params);
      return rows[0].count;
    } catch (error) {
      console.error('Error getting unread count:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      await db.query(
        `UPDATE notifications SET is_read = TRUE, updated_at = NOW() 
         WHERE id = ? AND user_id = ?`,
        [notificationId, userId.toString()]
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId) {
    try {
      await db.query(
        `UPDATE notifications SET is_read = TRUE, updated_at = NOW() 
         WHERE user_id = ? AND is_read = FALSE`,
        [userId.toString()]
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  // Create system notifications for specific events
  async createSystemNotification(event, data) {
    try {
      switch (event) {
        case 'appointment_created':
          await this.createAppointmentNotification(data, 'created');
          break;
        case 'appointment_updated':
          await this.createAppointmentNotification(data, 'updated');
          break;
        case 'appointment_cancelled':
          await this.createAppointmentNotification(data, 'cancelled');
          break;
        case 'new_customer':
          await this.createCustomerNotification(data);
          break;
        case 'staff_added':
          await this.createStaffNotification(data);
          break;
        default:
          console.warn('Unknown notification event:', event);
      }
    } catch (error) {
      console.error('Error creating system notification:', error);
      throw error;
    }
  }

  // Create appointment-related notifications
  async createAppointmentNotification(appointmentData, action) {
    try {
      const { appointmentId, customerId, staffId, serviceName, appointmentDate } = appointmentData;
      
      // Notify staff member
      if (staffId) {
        await this.createNotification(
          staffId,
          'appointment',
          `Appointment ${action}`,
          `${serviceName} appointment for ${appointmentDate} has been ${action}`,
          { 
            priority: 'high',
            metadata: { appointmentId, customerId, action }
          }
        );
      }

      // Notify managers
      const [managers] = await db.query(
        `SELECT id FROM users WHERE role = 'manager' AND isApproved = 1`
      );
      
      for (const manager of managers) {
        await this.createNotification(
          manager.id,
          'appointment',
          `Appointment ${action}`,
          `${serviceName} appointment has been ${action}`,
          { 
            priority: 'medium',
            metadata: { appointmentId, customerId, staffId, action }
          }
        );
      }
    } catch (error) {
      console.error('Error creating appointment notification:', error);
      throw error;
    }
  }

  // Create customer-related notifications
  async createCustomerNotification(customerData) {
    try {
      const { customerId, customerName, email } = customerData;
      
      // Notify managers and staff
      const [users] = await db.query(
        `SELECT id FROM users WHERE role IN ('manager', 'staff') AND isApproved = 1`
      );
      
      for (const user of users) {
        await this.createNotification(
          user.id,
          'customer',
          'New Customer Registration',
          `${customerName} (${email}) has registered as a new customer`,
          { 
            priority: 'low',
            metadata: { customerId, customerName, email }
          }
        );
      }
    } catch (error) {
      console.error('Error creating customer notification:', error);
      throw error;
    }
  }

  // Create staff-related notifications (manager only)
  async createStaffNotification(staffData) {
    try {
      const { staffId, staffName, role } = staffData;
      
      // Notify managers only
      const [managers] = await db.query(
        `SELECT id FROM users WHERE role = 'manager' AND isApproved = 1`
      );
      
      for (const manager of managers) {
        await this.createNotification(
          manager.id,
          'staff',
          'New Staff Member',
          `${staffName} has been added as ${role}`,
          { 
            priority: 'medium',
            metadata: { staffId, staffName, role }
          }
        );
      }
    } catch (error) {
      console.error('Error creating staff notification:', error);
      throw error;
    }
  }

  // Clean up expired notifications
  async cleanupExpiredNotifications() {
    try {
      await db.query(`DELETE FROM notifications WHERE expires_at < NOW()`);
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
    }
  }

  // Get notification settings for a user
  async getNotificationSettings(userId) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM notification_settings WHERE user_id = ?`,
        [userId.toString()]
      );
      return rows;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      throw error;
    }
  }

  // Update notification settings
  async updateNotificationSettings(userId, type, settings) {
    try {
      const { enabled, emailEnabled, pushEnabled } = settings;
      
      await db.query(
        `INSERT INTO notification_settings (id, user_id, notification_type, enabled, email_enabled, push_enabled) 
         VALUES (?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         enabled = VALUES(enabled), 
         email_enabled = VALUES(email_enabled), 
         push_enabled = VALUES(push_enabled),
         updated_at = NOW()`,
        [uuidv4(), userId.toString(), type, enabled, emailEnabled, pushEnabled]
      );
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
