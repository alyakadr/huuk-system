const Notification = require("../models/Notification");
const NotificationSettings = require("../models/NotificationSettings");
const User = require("../models/User");

function allowedTypesForRole(userRole) {
  if (userRole === "manager") return null;
  if (userRole === "staff") {
    return ["appointment", "customer", "general", "system"];
  }
  return ["appointment", "general"];
}

class NotificationService {
  async createNotification(userId, type, title, message, options = {}) {
    const { priority = "medium", expiresAt = null, metadata = null } = options;
    const userIdString = userId ? userId.toString() : "";

    const doc = await Notification.create({
      user_id: userIdString,
      type,
      title,
      message,
      priority,
      expires_at: expiresAt || null,
      metadata,
    });

    return doc._id.toString();
  }

  async getNotificationsForUser(userId, userRole, options = {}) {
    const { limit = 10, offset = 0, unreadOnly = false, type = null } = options;
    const uid = userId.toString();

    const filter = {
      user_id: uid,
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
    };

    const allowed = allowedTypesForRole(userRole);
    if (allowed) {
      if (type) {
        filter.type = allowed.includes(type) ? type : { $in: [] };
      } else {
        filter.type = { $in: allowed };
      }
    } else if (type) {
      filter.type = type;
    }

    if (unreadOnly) {
      filter.is_read = false;
    }

    const rows = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return rows.map((r) => ({
      ...r,
      id: r._id.toString(),
    }));
  }

  async getUnreadCount(userId, userRole) {
    const uid = userId.toString();
    const filter = {
      user_id: uid,
      is_read: false,
      $or: [{ expires_at: null }, { expires_at: { $gt: new Date() } }],
    };
    const allowed = allowedTypesForRole(userRole);
    if (allowed) {
      filter.type = { $in: allowed };
    }
    return Notification.countDocuments(filter);
  }

  async markAsRead(notificationId, userId) {
    await Notification.updateOne(
      { _id: notificationId, user_id: userId.toString() },
      { $set: { is_read: true } }
    );
  }

  async markAllAsRead(userId) {
    await Notification.updateMany(
      { user_id: userId.toString(), is_read: false },
      { $set: { is_read: true } }
    );
  }

  async createSystemNotification(event, data) {
    switch (event) {
      case "appointment_created":
        await this.createAppointmentNotification(data, "created");
        break;
      case "appointment_updated":
        await this.createAppointmentNotification(data, "updated");
        break;
      case "appointment_cancelled":
        await this.createAppointmentNotification(data, "cancelled");
        break;
      case "new_customer":
        await this.createCustomerNotification(data);
        break;
      case "staff_added":
        await this.createStaffNotification(data);
        break;
      default:
        console.warn("Unknown notification event:", event);
    }
  }

  async createAppointmentNotification(appointmentData, action) {
    const { appointmentId, customerId, staffId, serviceName, appointmentDate } = appointmentData;

    if (staffId) {
      await this.createNotification(
        staffId,
        "appointment",
        `Appointment ${action}`,
        `${serviceName} appointment for ${appointmentDate} has been ${action}`,
        {
          priority: "high",
          metadata: { appointmentId, customerId, action },
        }
      );
    }

    const managers = await User.find({ role: "manager", isApproved: 1 }).select("_id").lean();
    for (const m of managers) {
      await this.createNotification(
        m._id,
        "appointment",
        `Appointment ${action}`,
        `${serviceName} appointment has been ${action}`,
        {
          priority: "medium",
          metadata: { appointmentId, customerId, staffId, action },
        }
      );
    }
  }

  async createCustomerNotification(customerData) {
    const { customerId, customerName, email } = customerData;
    const users = await User.find({
      role: { $in: ["manager", "staff"] },
      isApproved: 1,
    })
      .select("_id")
      .lean();

    for (const u of users) {
      await this.createNotification(
        u._id,
        "customer",
        "New Customer Registration",
        `${customerName} (${email}) has registered as a new customer`,
        {
          priority: "low",
          metadata: { customerId, customerName, email },
        }
      );
    }
  }

  async createStaffNotification(staffData) {
    const { staffId, staffName, role } = staffData;
    const managers = await User.find({ role: "manager", isApproved: 1 }).select("_id").lean();

    for (const m of managers) {
      await this.createNotification(
        m._id,
        "staff",
        "New Staff Member",
        `${staffName} has been added as ${role}`,
        {
          priority: "medium",
          metadata: { staffId, staffName, role },
        }
      );
    }
  }

  async cleanupExpiredNotifications() {
    await Notification.deleteMany({ expires_at: { $lt: new Date() } });
  }

  async getNotificationSettings(userId) {
    return NotificationSettings.find({ user_id: userId.toString() }).lean();
  }

  async updateNotificationSettings(userId, type, settings) {
    const { enabled, emailEnabled, pushEnabled } = settings;
    await NotificationSettings.findOneAndUpdate(
      { user_id: userId.toString(), notification_type: type },
      {
        user_id: userId.toString(),
        notification_type: type,
        enabled,
        email_enabled: emailEnabled,
        push_enabled: pushEnabled,
      },
      { upsert: true, new: true }
    );
  }
}

module.exports = new NotificationService();
