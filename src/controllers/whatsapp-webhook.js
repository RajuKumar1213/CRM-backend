import { Lead } from '../models/Lead.models.js';
import { User } from '../models/User.models.js';
import { Activity } from '../models/Activity.models.js';
import { assignLeadToNextEmployee } from '../utils/leadRotation.js';
import { scheduleFollowUp } from '../utils/followUpScheduler.js';
import twilio from 'twilio';

const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * Handles incoming WhatsApp messages from Twilio webhook
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleWhatsAppWebhook = async (req, res) => {
  // Always log the incoming webhook for debugging
  console.log("í²¬ Twilio WhatsApp webhook received");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  
  // Create TwiML response object early
  const twiml = new MessagingResponse();
  
  try {
    // Extract message data - Twilio sends form data
    const { Body, From, ProfileName, MessageSid, SmsStatus } = req.body;

    // For status updates (delivered, read, etc.), send minimal response
    if (SmsStatus) {
      console.log(`Status update: ${SmsStatus} for message ${MessageSid}`);
      res.status(200).send('Status update acknowledged');
      return;
    }
    
    // Basic validation - Twilio always sends From and Body
    if (!From || !Body) {
      console.log("Missing From or Body in request");
      twiml.message('Thank you for your message.');
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml.toString());
      return;
    }

    // Process the phone number (remove WhatsApp prefix)
    const phoneNumber = From.replace('whatsapp:', '');
    console.log(`Processing message from ${phoneNumber}: ${Body}`);
    
    // Try to find an existing lead with this phone number
    let lead = await Lead.findOne({ phone: phoneNumber });
    const isNewLead = !lead;
    
    if (isNewLead) {
      // Create new lead with basic info
      lead = new Lead({
        name: ProfileName || phoneNumber,
        phone: phoneNumber,
        message: Body,
        source: 'whatsapp',
        messageSid: MessageSid,
        status: 'new',
        lastContactMethod: 'whatsapp',
        lastContacted: new Date(),
      });
      
      try {
        await lead.save();
        console.log(`New lead created with ID: ${lead._id}`);
        
        // Assign the lead to an employee
        const nextEmployee = await assignLeadToNextEmployee(lead);
        if (nextEmployee) {
          lead.assignedTo = nextEmployee._id;
          await lead.save();
          
          // Schedule follow-up
          await scheduleFollowUp(
            lead,
            nextEmployee._id,
            'whatsapp',
            1 // Default: 1 day
          );
        }
      } catch (error) {
        console.error("Error saving lead:", error);
        // Continue execution for response
      }
      
      // Response for new leads
      twiml.message('Thank you for contacting us! Our team will get in touch with you shortly.');
    } else {
      // Update existing lead
      lead.message = lead.message ? `${lead.message}\n${Body}` : Body;
      lead.messageSid = MessageSid;
      lead.lastContactMethod = 'whatsapp';
      lead.lastContacted = new Date();
      
      try {
        await lead.save();
        console.log(`Updated lead: ${lead._id}`);
        
        // Create activity for the follow-up
        await Activity.create({
          lead: lead._id,
          user: lead.assignedTo || null,
          type: 'whatsapp',
          status: 'completed',
          notes: 'Follow-up message received',
        });
      } catch (error) {
        console.error("Error updating lead:", error);
        // Continue execution for response
      }
      
      // Response for existing leads
      twiml.message('We have received your message and will respond shortly.');
    }
    
    // Send the TwiML response
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml.toString());
    
  } catch (error) {
    console.error("Error in webhook handler:", error);
    
    // Send a simple response to prevent 502 errors
    try {
      twiml.message('Message received. Thank you.');
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml.toString());
    } catch (responseError) {
      // Last resort fallback
      res.status(200).send('Message received');
    }
  }
};
