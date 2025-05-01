import { Notification } from '../models/Notification.models.js';
import { FollowUp } from '../models/FollowUp.models.js';
import  moment  from 'moment';
import { CompanySetting } from '../models/CompanySettings.models.js';

/**
 * Schedule a follow-up for a lead
 * @param {Object} lead - The lead object
 * @param {String} userId - The ID of the user responsible for the follow-up
 * @param {String} followUpType - The type of follow-up (call, whatsapp, email, etc.)
 * @param {Number} daysInterval - Optional days to wait before follow-up, defaults to company settings
 * @returns {Promise<Object>} - The created follow-up
 */
export const scheduleFollowUp = async (
  lead,
  userId,
  followUpType,
  daysInterval = null
) => {
  try {
    // Get company settings for default intervals
    const settings = await CompanySetting.findOne();

    if (!daysInterval) {
      // Use default interval based on lead status from company settings
      daysInterval = settings.defaultFollowupIntervals[lead.status] || 2;
    }

    // Calculate scheduled date
    const scheduledDate = moment().add(daysInterval, 'days').toDate();

    // Create follow-up
    const followUp = await FollowUp.create({
      lead: lead._id,
      assignedTo: userId,
      scheduled: scheduledDate,
      followUpType,
      status: 'pending',
      interval: daysInterval,
    });

    // Create notification for the future (to be displayed on the day of follow-up)
    await Notification.create({
      user: userId,
      title: 'Follow-Up Reminder',
      message: `Reminder to follow up with ${lead.name} via ${followUpType}.`,
      type: 'followup',
      relatedTo: followUp._id,
      onModel: 'FollowUp',
      isRead: false,
    });

    return followUp;
  } catch (error) {
    console.error('Error scheduling follow-up:', error);
    throw error;
  }
};

/**
 * Get all follow-ups due today for a user
 * @param {String} userId - The ID of the user
 * @returns {Promise<Array>} - Array of follow-ups due today
 */
export const getTodayFollowUps = async (userId) => {
  const startOfDay = moment().startOf('day').toDate();
  const endOfDay = moment().endOf('day').toDate();

  return FollowUp.find({
    assignedTo: userId,
    scheduled: { $gte: startOfDay, $lte: endOfDay },
    status: 'pending',
  }).populate('lead');
};
