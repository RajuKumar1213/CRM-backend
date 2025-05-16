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
 * Send a WhatsApp message
 * @param {Object} messageData - Contains all necessary data for sending a message
 * @param {String} messageData.leadId - The ID of the lead
 * @param {String} messageData.userId - The ID of the user sending the message
 * @param {String} messageData.templateId - The ID of the template to use (optional)
 * @param {String} messageData.senderPhone - The sender's phone number
 * @param {String} messageData.recipientPhone - The recipient's phone number
 * @param {String} messageData.messageContent - The message content
 * @returns {Promise<Object>} - The response from WhatsApp API provider
 */
export const sendWhatsAppMessage = async (messageData) => {
  const {
    leadId,
    userId,
    templateId,
    senderPhone,
    recipientPhone,
    messageContent
  } = messageData;
  
  let message = null; // Declare message outside try block

  try {
    // Get company settings for provider info
    const settings = await CompanySetting.findOne();
    if (!settings) {
      throw new ApiError(404, 'Company settings not found');
    }
    
    // Validate required data
    if (!senderPhone) {
      throw new ApiError(400, 'Sender phone number is required');
    }
    
    if (!recipientPhone) {
      throw new ApiError(400, 'Recipient phone number is required');
    }

    if (!messageContent) {
      throw new ApiError(400, 'Message content is required');
    }
      // Create WhatsApp message record
    message = await WhatsAppMessage.create({
      lead: leadId,
      user: userId,
      template: templateId || null,
      content: messageContent, 
      status: 'queued',
      sentFrom: senderPhone,
      sentTo: recipientPhone,
    });

    if (!message) {
      throw new ApiError(500, 'Failed to create WhatsApp message');
    }

    // Send message via configured provider
    let apiResponse;
    const provider = settings.whatsappApiProvider || 'twilio'; // Default to twilio

    switch (provider) {
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
          to: `whatsapp:${recipientPhone}`,
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

    return {
      success: true,
      message: message,
      apiResponse: apiResponse
    };  } catch (error) {
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
