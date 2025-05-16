import { Lead } from '../models/Lead.models.js';
import { User } from '../models/User.models.js';
import { Activity } from '../models/Activity.models.js';
import { sendWhatsAppMessage } from './watsappService.js';
import { getNextAvailableNumber } from './phoneNumberRotation.js';
import { getIO } from './socket.js';
import { ApiError } from './ApiError.js';

/**
 * Send a WhatsApp notification to an employee when a lead is assigned to them
 * @param {Object} lead - The lead object
 * @param {Object} user - The user object (employee)
 * @returns {Promise<Object>} - The response from WhatsApp API provider
 */
export const sendLeadAssignmentNotification = async (lead, user) => {
  if (!lead || !user || !user.phone) {
    console.error('Missing data for WhatsApp notification:', {
      leadExists: !!lead,
      userExists: !!user,
      userHasPhone: !!(user && user.phone)
    });
    return null;
  }

  try {
    const senderNumber = await getNextAvailableNumber();
    if (!senderNumber) {
      console.error('No available sender phone number for WhatsApp notification');
      return null;
    }

    // Craft a personalized message
    let messageContent = `🆕 New Lead Assignment\n\n`;
    messageContent += `Name: ${lead.name}\n`;
    messageContent += `Phone: ${lead.phone}\n`;
    
    if (lead.company) {
      messageContent += `Company: ${lead.company}\n`;
    }
    
    if (lead.interestedIn) {
      messageContent += `Interested in: ${lead.interestedIn}\n`;
    }
    
    if (lead.source) {
      messageContent += `Source: ${lead.source.toUpperCase()}\n`;
    }
    
    messageContent += `\nPlease follow up with this lead as soon as possible.`;

    // Send the message
    const result = await sendWhatsAppMessage({
      leadId: lead._id,
      userId: user._id,
      templateId: null,
      senderPhone: senderNumber.phoneNumber,
      recipientPhone: user.phone,
      messageContent
    });

    // Create activity record for this notification
    if (result && result.success) {
      await Activity.create({
        lead: lead._id,
        user: user._id,
        type: 'whatsapp',
        status: 'completed',
        notes: `Lead assignment notification sent`,
        templateUsed: null,
      });
    }

    return result;
  } catch (error) {
    console.error('Error sending WhatsApp lead assignment notification:', error);
    return null;
  }
};

/**
 * Send a WhatsApp notification to an employee about an upcoming follow-up
 * @param {Object} followUp - The follow-up object
 * @param {Object} user - The user object (employee)
 * @param {Number} minutesRemaining - Minutes remaining until the follow-up
 * @returns {Promise<Object>} - The response from WhatsApp API provider
 */
export const sendFollowUpReminder = async (followUp, user, minutesRemaining) => {
  if (!followUp || !followUp.lead || !user || !user.phone) {
    console.error('Missing data for WhatsApp follow-up reminder:', {
      followUpExists: !!followUp,
      followUpHasLead: !!(followUp && followUp.lead),
      userExists: !!user,
      userHasPhone: !!(user && user.phone)
    });
    return null;
  }

  try {
    const senderNumber = await getNextAvailableNumber();
    if (!senderNumber) {
      console.error('No available sender phone number for follow-up reminder');
      return null;
    }

    const lead = followUp.lead;
    
    // Craft a personalized message
    let messageContent = `⏰ Follow-Up Reminder\n\n`;
    messageContent += `You have a follow-up scheduled in ${minutesRemaining} minutes with:\n\n`;
    messageContent += `Name: ${lead.name}\n`;
    messageContent += `Phone: ${lead.phone}\n`;
    
    if (lead.company) {
      messageContent += `Company: ${lead.company}\n`;
    }
    
    if (lead.interestedIn) {
      messageContent += `Interested in: ${lead.interestedIn}\n`;
    }
    
    if (followUp.notes) {
      messageContent += `\nNotes: ${followUp.notes}\n`;
    }
    
    if (followUp.followUpType === 'whatsapp') {
      messageContent += `\nPlease reach out via WhatsApp for this follow-up.`;
    }

    // Send the message
    const result = await sendWhatsAppMessage({
      leadId: lead._id,
      userId: user._id,
      templateId: null,
      senderPhone: senderNumber.phoneNumber,
      recipientPhone: user.phone,
      messageContent
    });

    // Create activity record for this reminder
    if (result && result.success) {
      await Activity.create({
        lead: lead._id,
        user: user._id,
        type: 'whatsapp',
        status: 'completed',
        notes: `Follow-up reminder sent to employee`,
        templateUsed: null,
      });
      
      // Also send a socket notification
      try {
        const io = getIO();
        io.to(user._id.toString()).emit('notification', {
          type: 'follow-up',
          title: 'Upcoming Follow-up',
          message: `Follow-up scheduled with ${lead.name} in ${minutesRemaining} minutes`,
          data: followUp,
          createdAt: new Date(),
        });
      } catch (socketError) {
        console.error('Socket error sending follow-up notification:', socketError);
      }
    }

    return result;
  } catch (error) {
    console.error('Error sending WhatsApp follow-up reminder:', error);
    return null;
  }
};
