/**
 * Notification Service
 * Handles sending notifications to users
 */

// Since the models are defined in server.js, we'll export functions that will be called with the models
// This creates a circular dependency issue, so we'll pass the models as parameters when needed

/**
 * Send notification to a user
 * @param {string} userId - User ID to send notification to
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.type - Notification type (info, success, warning, error)
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {string} [notificationData.link] - Optional link
 * @param {Object} models - Mongoose models object
 */
async function sendNotification(userId, notificationData, models) {
  try {
    const Notification = models.Notification; // Get the Notification model from the models object

    const notification = await Notification.create({
      userId,
      type: notificationData.type || "info",
      title: notificationData.title,
      message: notificationData.message,
      link: notificationData.link,
    });

    // In a real implementation, you would emit this to the user's socket
    // io.to(userSocketId).emit('notification', notification);

    console.log(`Notification sent to user ${userId}:`, notificationData.message);
    return notification;
  } catch (error) {
    console.error("Failed to send notification:", error);
    throw error;
  }
}

/**
 * Get user notifications
 * @param {string} userId - User ID
 * @param {Object} models - Mongoose models object
 * @returns {Array} Array of notifications
 */
async function getUserNotifications(userId, models) {
  try {
    const Notification = models.Notification; // Get the Notification model from the models object

    const notifications = await Notification.find({
      userId
    }).sort({ createdAt: -1 }).limit(50);

    return notifications;
  } catch (error) {
    console.error("Failed to get user notifications:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security check)
 * @param {Object} models - Mongoose models object
 * @returns {Object} Updated notification
 */
async function markAsRead(notificationId, userId, models) {
  try {
    const Notification = models.Notification; // Get the Notification model from the models object

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new Error("Notification not found or unauthorized");
    }

    return notification;
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    throw error;
  }
}

/**
 * Mark all user notifications as read
 * @param {string} userId - User ID
 * @param {Object} models - Mongoose models object
 * @returns {number} Number of notifications marked as read
 */
async function markAllAsRead(userId, models) {
  try {
    const Notification = models.Notification; // Get the Notification model from the models object

    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    return result.modifiedCount;
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    throw error;
  }
}

/**
 * Delete notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security check)
 * @param {Object} models - Mongoose models object
 * @returns {boolean} True if deleted
 */
async function deleteNotification(notificationId, userId, models) {
  try {
    const Notification = models.Notification; // Get the Notification model from the models object

    const result = await Notification.deleteOne({
      _id: notificationId,
      userId
    });

    return result.deletedCount > 0;
  } catch (error) {
    console.error("Failed to delete notification:", error);
    throw error;
  }
}

module.exports = {
  sendNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};