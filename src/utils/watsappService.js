import { WhatsAppMessage } from '../models/WatsappMessage.models.js';
import { WhatsappTemplate } from '../models/WatsappTemplate.models.js';
import { CompanySetting } from '../models/CompanySettings.models.js';
import { Lead } from '../models/Lead.models.js';
import axios from 'axios';
import twilio from 'twilio';
import { ApiError } from './ApiError.js';
import dotenv from 'dotenv';
import { Activity } from '../models/Activity.models.js';

dotenv.config();

/**
 * Send a WhatsApp message using a template
 * @param {String} leadId - The ID of the lead
 * @param {String} userId - The ID of the user sending the message
 * @param {String} templateId - The ID of the template to use
 * @param {String} leadPhone - The phone number of the lead
 * @param {String} messageContent - The message content
 * @returns {Promise<Object>} - The sent message
 */
export const sendWhatsAppMessage = async (
  leadId,
  userId,
  templateId,
  senderPhone,
  messageContent
) => {
  let message = null; // Declare message outside try block

  try {
    // Get lead, template, and company settings
    const [lead, template, settings] = await Promise.all([
      Lead.findById(leadId),
      WhatsappTemplate.findById(templateId),
      CompanySetting.findOne(),
    ]);

    if (!lead) {
      throw new ApiError(404, `Lead not found with id ${leadId}`);
    }
    if (!template && templateId) {
      throw new ApiError(404, `Template not found with id ${templateId}`);
    }
    if (!settings) {
      throw new ApiError(404, 'Company settings not found');
    }

    // Create WhatsApp message record
    message = await WhatsAppMessage.create({
      lead: leadId,
      user: userId,
      template: templateId || null,
      content: messageContent,
      status: 'queued',
      sentFrom: senderPhone || 'whatsapp:+14155238886', // Fallback to Twilio sandbox
      sentTo: lead.phone,
    });

    if (!message) {
      throw new ApiError(500, 'Failed to create WhatsApp message');
    }

    // Prepare API request based on provider
    let apiResponse;
    const provider = settings.whatsappApiProvider || 'twilio'; // Default to twilio

    switch (provider) {
      case '360dialog':
        if (!settings.whatsappApiKey || !settings.whatsappApiUrl) {
          throw new ApiError(500, 'WhatsApp API not configured for 360dialog');
        }
        apiResponse = await axios.post(
          settings.whatsappApiUrl,
          {
            recipient_type: 'individual',
            to: lead.phone,
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
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
          throw new ApiError(500, 'Twilio credentials not configured');
        }

        const client = twilio(accountSid, authToken);
        apiResponse = await client.messages.create({
          body: messageContent,
          from: `whatsapp:${senderPhone}`,
          to: `whatsapp:${lead.phone}`,
        });
        break;

      default:
        throw new ApiError(
          500,
          `Unsupported WhatsApp API provider: ${provider}`
        );
    }

    // Update message with response data
    await WhatsAppMessage.findByIdAndUpdate(message._id, {
      status: 'sent',
      sentAt: Date.now(),
      messageId: apiResponse?.sid || apiResponse?.data?.id || 'unknown',
    });

    // Create activity record
    await Activity.create({
      lead: leadId,
      user: userId,
      type: 'whatsapp',
      status: 'completed',
      notes: `WhatsApp message sent: ${messageContent.substring(0, 50)}...`,
      templateUsed: templateId || null,
    });

    return message;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);

    // Update message status to failed if it was created
    if (message?._id) {
      await WhatsAppMessage.findByIdAndUpdate(message._id, {
        status: 'failed',
        error: error.message,
      });
    }
    throw new ApiError(500, 'Error sending WhatsApp message', error);
  }
};
