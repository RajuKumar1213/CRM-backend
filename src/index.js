import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';
import cron from 'node-cron';
import { sendWhatsAppMessage } from './utils/watsappService.js';
import { Lead } from './models/Lead.models.js';
import { User } from './models/User.models.js';
import { FollowUp } from './models/FollowUp.models.js';

dotenv.config({ path: './.env' });

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`⚙️  Server is running on port ${process.env.PORT}`);
    });
    app.on('error', (error) => console.log('ERROR', error));
  })
  .catch((error) => {
    console.log('MONGODB CONNECTION ERROR', error);
  });

// Send WhatsApp to employee when a new lead is assigned
Lead.watch().on('change', async (change) => {
  if (change.operationType === 'insert' || change.operationType === 'update') {
    const leadId = change.documentKey._id;
    const lead = await Lead.findById(leadId).populate('assignedTo');
    if (lead && lead.assignedTo && lead.assignedTo.phone) {
      try {
        await sendWhatsAppMessage(
          lead._id,
          lead.assignedTo._id,
          null,
          process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
          `A new lead (${lead.name}, ${lead.phone}) has been assigned to you in CRM.`
        );
      } catch (err) {
        console.error('Failed to send WhatsApp assignment notification:', err.message);
      }
    }
  }
});

// Cron job: every day at 8:00 AM, remind employees of today's follow-ups
cron.schedule('0 8 * * *', async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const followUps = await FollowUp.find({
    scheduled: { $gte: today, $lt: tomorrow },
  }).populate('assignedTo lead');
  for (const fu of followUps) {
    if (fu.assignedTo && fu.assignedTo.phone) {
      try {
        await sendWhatsAppMessage(
          fu.lead._id,
          fu.assignedTo._id,
          null,
          process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
          `Reminder: You have a follow-up scheduled today for lead ${fu.lead.name} (${fu.lead.phone}) in CRM.`
        );
      } catch (err) {
        console.error('Failed to send WhatsApp follow-up reminder:', err.message);
      }
    }
  }
});
