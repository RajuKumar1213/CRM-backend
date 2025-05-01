import { CallLog } from '../models/CallLogs.models';
import { Lead } from '../models/Lead.models';

/**
 * Generate call URL for native phone dialer
 * @param {String} phoneNumber - The phone number to call
 * @returns {String} - URL for initiating call
 */
exports.generateCallUrl = (phoneNumber) => {
  // Format phone number to ensure it works with tel: protocol
  const formattedNumber = phoneNumber.replace(/[^\d+]/g, '');
  return `tel:${formattedNumber}`;
};

/**
 * Log an outbound call
 * @param {String} leadId - The ID of the lead being called
 * @param {String} userId - The ID of the user making the call
 * @param {String} fromNumber - The number used to make the call
 * @param {String} toNumber - The number being called
 * @param {String} status - Call status (connected, missed, etc.)
 * @param {Number} duration - Call duration in seconds
 * @returns {Promise<Object>} - The created call log
 */
exports.logCall = async (
  leadId,
  userId,
  fromNumber,
  toNumber,
  status,
  duration = 0
) => {
  try {
    // Create call log
    const callLog = await CallLog.create({
      lead: leadId,
      user: userId,
      callType: 'outgoing',
      status,
      duration,
      calledFrom: fromNumber,
      calledTo: toNumber,
      startTime: new Date(Date.now() - duration * 1000),
      endTime: Date.now(),
    });

    // Update lead's last contacted date
    await Lead.findByIdAndUpdate(leadId, {
      lastContacted: Date.now(),
      contactedWith: fromNumber,
    });

    // Create activity record
    await Activity.create({
      lead: leadId,
      user: userId,
      type: 'call',
      status,
      duration,
      notes: `Call ${status}, duration: ${Math.floor(duration / 60)}m ${duration % 60}s`,
    });

    return callLog;
  } catch (error) {
    console.error('Error logging call:', error);
    throw error;
  }
};
