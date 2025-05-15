import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { httpServer, app } from './app.js';
import cron from 'node-cron';
import { sendWhatsAppMessage } from './utils/watsappService.js';
import { Lead } from './models/Lead.models.js';
import { User } from './models/User.models.js';
import { FollowUp } from './models/FollowUp.models.js';
import { getNextAvailableNumber } from './utils/phoneNumberRotation.js';
import { getIO } from './utils/socket.js';

dotenv.config({ path: './.env' });

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`⚙️  Server is running on port ${PORT}`);
    });
    httpServer.on('error', (error) => console.log('ERROR', error));
  })
  .catch((error) => {
    console.log('MONGODB CONNECTION ERROR', error);
  });

// Send WhatsApp to employee when a new lead is assigned
Lead.watch().on('change', async (change) => {
  if (change.operationType === 'insert' || change.operationType === 'update') {
    const leadId = change.documentKey._id;
    const lead = await Lead.findById(leadId).populate('assignedTo');
    const user = await User.findById(lead.assignedTo._id);
    if(!user || !user.phone) {
      console.error('User not found or phone number missing for lead assignment notification');
      return;
    }

    const senderPhone = getNextAvailableNumber();
    if (!senderPhone) {
      console.error('No available sender phone number for WhatsApp message');
      return;
    }
      // Convert old status values to new ones if needed
   
    if (lead && lead.assignedTo) {
      try {
        const senderPhone = await getNextAvailableNumber();
        if (senderPhone) {
          await sendWhatsAppMessage(
            lead._id,
            user._id,
            null,
            senderPhone,
            `A new lead (${lead.name}, ${lead.phone}) has been assigned to you in CRM.`
          );
        }
      } catch (err) {
        console.error('Failed to send WhatsApp assignment notification:', err.message);
      }
    }
  }
});

// Daily reminder at 8:00 AM for today's follow-ups
cron.schedule('0 8 * * *', async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const followUps = await FollowUp.find({
    scheduled: { $gte: today, $lt: tomorrow },
    status: { $nin: ['completed', 'cancelled'] }
  }).populate('assignedTo lead');

  for (const fu of followUps) {
    if (fu.assignedTo && fu.assignedTo.phone) {      try {
        const senderPhone = await getNextAvailableNumber();
        if (senderPhone) {
          await sendWhatsAppMessage(
            fu.lead._id,
            fu.assignedTo._id,
            null,
            senderPhone,
            `Reminder: You have a follow-up scheduled today for lead ${fu.lead.name} (${fu.lead.phone}) in CRM.`
          );
        }
      } catch (err) {
        console.error('Failed to send WhatsApp follow-up reminder:', err.message);
      }
    }
  }
});

// Check for follow-ups every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const fiveMinutesAhead = new Date(now.getTime() + 5 * 60000);
    
    // Find follow-ups scheduled for the next 5 minutes
    const upcomingFollowUps = await FollowUp.find({
      scheduled: {
        $gte: now,
        $lte: fiveMinutesAhead
      },
      status: { $nin: ['completed', 'cancelled'] }
    }).populate('assignedTo lead');

    // Get the Socket.IO instance
    const io = getIO();

    for (const followUp of upcomingFollowUps) {
      if (followUp.lead && followUp.assignedTo) {
        // Send socket notification
        io.to(followUp.assignedTo._id.toString()).emit('notification', {
          type: 'follow-up',
          title: 'Upcoming Follow-up',
          message: `Follow-up scheduled with ${followUp.lead.name} in ${Math.round((followUp.scheduled - now) / 60000)} minutes`,
          data: followUp,
          createdAt: new Date()
        });        // Send WhatsApp message
        try {
          const senderPhone = await getNextAvailableNumber();

          console.log(senderPhone, followUp.lead.phone);
          if (senderPhone && followUp.lead.phone) {
            await sendWhatsAppMessage(
              followUp.lead._id,
              followUp.assignedTo._id,
              null,
              senderPhone,
              `Hi ${followUp.lead.name}, this is a reminder for your scheduled follow-up with us.`
            );
          }
        } catch (err) {
          console.error('Failed to send follow-up WhatsApp message:', err.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in follow-up check cron job:', error);
  }
});
