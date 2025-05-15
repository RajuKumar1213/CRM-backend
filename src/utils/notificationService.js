import { Notification } from '../models/Notification.models.js';
import { User } from '../models/User.models.js';
import { getIO } from './socket.js';

/**
 * Get unread notifications for a user
 * @param {String} userId - The ID of the user
 * @returns {Promise<Array>} - Array of unread notifications
 */
export const getUnreadNotifications = async (userId) => {
  return Notification.find({
    user: userId,
    isRead: false,
  })
    .sort('-createdAt')
    .limit(50);
};

/**
 * Mark notifications as read
 * @param {String} userId - The ID of the user
 * @param {Array} notificationIds - Array of notification IDs to mark as read
 * @returns {Promise<Number>} - Number of notifications marked as read
 */

exports.markNotificationsAsRead = async (userId, notificationIds) => {
  const result = await Notification.updateMany(
    {
      _id: { $in: notificationIds },
      user: userId,
    },
    { isRead: true }
  );
  return result.nModified;
};

/**
 * Create a notification for a user
 * @param {String} userId - The ID of the user
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {String} type - Notification type
 * @param {String} relatedTo - ID of related entity
 * @param {String} onModel - Model name of related entity
 * @returns {Promise<Object>} - The created notification
 */
export const createNotification = async (
  userId,
  title,
  message,
  type = 'system',
  relatedTo = null,
  onModel = null
) => {
  const notification = {
    user: userId,
    title,
    message,
    type,
  };

  if (relatedTo && onModel) {
    notification.relatedTo = relatedTo;
    notification.onModel = onModel;
  }

  const createdNotification = await Notification.create(notification);
  
  // Emit to specific user's room
  try {
    const io = getIO();
    io.to(userId.toString()).emit('newNotification', createdNotification);
  } catch (error) {
    console.error('Socket error:', error);
  }

  return createdNotification;
};
