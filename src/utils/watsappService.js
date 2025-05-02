import { WhatsAppMessage } from '../models/WatsappMessage.models.js';
import { WhatsappTemplate } from '../models/WatsappTemplate.models.js';
import { CompanySetting } from '../models/CompanySettings.models.js';
import { Lead } from '../models/Lead.models.js';
import axios from 'axios';
import { ApiError } from './ApiError.js';

/**
 * Send a WhatsApp message using a template
 * @param {String} leadId - The ID of the lead
 * @param {String} userId - The ID of the user sending the message
 * @param {String} templateId - The ID of the template to use
 * @param {Object} variables - Object with variable values to replace in template
 * @returns {Promise<Object>} - The sent message
 */
export const sendWhatsAppMessage = async (
  leadId,
  userId,
  templateId,
  nextNumber,
  leadPhone,
  messageContent
) => {
  try {
    // Get lead, template and company settings
    const [lead, template, settings] = await Promise.all([
      Lead.findById(leadId),
      WhatsappTemplate.findById(templateId),
      CompanySetting.findOne(),
    ]);

    if (!lead || !template || !settings) {
      throw new ApiError(
        404,
        'Missing required data for sending WhatsApp message'
      );
    }

    // Validate WhatsApp API configuration
    if (!settings.whatsappApiKey || !settings.whatsappApiUrl) {
      throw new Error('WhatsApp API not configured');
    }

    const message = await WhatsAppMessage.create({
      lead: leadId,
      user: userId,
      template: templateId,
      content: messageContent,
      variables: variables,
      status: 'queued',
      sentFrom: nextNumber,
      sentTo: lead.phone,
    });

    // Prepare API request based on provider
    let apiResponse;

    switch (settings.whatsappApiProvider) {
      case '360dialog':
        apiResponse = await axios.post(
          settings.whatsappApiUrl,
          {
            recipient_type: 'individual',
            to: leadPhone,
            type: 'text',
            text: {
              body: messageContent,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${settings.whatsappApiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
        break;

      case 'twilio':
        apiResponse = await axios.post(
          settings.whatsappApiUrl,
          new URLSearchParams({
            From: `whatsapp:${nextNumber}`,
            To: `whatsapp:${leadPhone}`,
            Body: messageContent,
          }),
          {
            headers: {
              Authorization: `Basic ${Buffer.from(settings.whatsappApiKey).toString('base64')}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );
        break;

      // Add more providers as needed
      default:
        throw new Error(
          `Unsupported WhatsApp API provider: ${settings.whatsappApiProvider}`
        );
    }

    // Update message with response data
    await WhatsAppMessage.findByIdAndUpdate(message._id, {
      status: 'sent',
      sentAt: Date.now(),
      messageId: apiResponse.data.id || apiResponse.data.sid || null,
    });

    // Create activity record
    await Activity.create({
      lead: leadId,
      user: userId,
      type: 'whatsapp',
      status: 'completed',
      notes: `WhatsApp message sent: ${messageContent.substring(0, 50)}...`,
    });

    return message;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);

    // Update message status to failed if it was created
    if (message && message._id) {
      await WhatsAppMessage.findByIdAndUpdate(message._id, {
        status: 'failed',
        error: error.message,
      });
    }

    throw error;
  }
};
