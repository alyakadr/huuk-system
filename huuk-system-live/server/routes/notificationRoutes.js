const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const authMiddleware = require('../middlewares/authMiddleware');

// Get notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 10, offset = 0, unreadOnly = false, type = null } = req.query;
    
    const notifications = await notificationService.getNotificationsForUser(
      req.userId,
      req.role,
      {
        limit: parseInt(limit),
        offset: parseInt(offset),
        unreadOnly: unreadOnly === 'true',
        type: type
      }
    );
    
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get unread notification count
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.userId, req.role);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.markAsRead(id, req.userId);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark all notifications as read (managers only)
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    if (req.role !== 'manager') {
      return res.status(403).json({ message: 'Manager role required' });
    }
    
    await notificationService.markAllAsRead(req.userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get notification settings
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await notificationService.getNotificationSettings(req.userId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update notification settings
router.put('/settings/:type', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params;
    const { enabled, emailEnabled, pushEnabled } = req.body;
    
    await notificationService.updateNotificationSettings(req.userId, type, {
      enabled,
      emailEnabled,
      pushEnabled
    });
    
    res.json({ message: 'Notification settings updated' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
