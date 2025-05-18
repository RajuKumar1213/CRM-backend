import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { httpServer, app } from './app.js';
import cron from 'node-cron';
import { sendWhatsAppMessage } from './utils/watsappService.js';
import { Lead } from './models/Lead.models.js';
import { User } from './models/User.models.js';
import { FollowUp } from './models/FollowUp.models.js';
import { Activity } from './models/Activity.models.js';
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
  // Only send notification for new leads or when assignedTo field changes
  if (
    change.operationType === 'insert' ||
    (change.operationType === 'update' &&
      change.updateDescription?.updatedFields?.assignedTo)
  ) {
    const leadId = change.documentKey._id;
    const lead = await Lead.findById(leadId).populate('assignedTo');

    // Only proceed if lead has an assignedTo field
    if (lead && lead.assignedTo) {
      const user = await User.findById(lead.assignedTo._id);
      if (!user || !user.phone) {
        console.error(
          'User not found or phone number missing for lead assignment notification'
        );
        return;
      }

      // For new leads or specific assignedTo changes, send notification
      // If it's a WhatsApp lead, use specialized notification
      if (lead.source === 'whatsapp') {
        try {
          const { sendLeadAssignmentNotification } = await import(
            './utils/whatsappNotifications.js'
          );
          await sendLeadAssignmentNotification(lead, user);
        } catch (err) {
          console.error(
            'Failed to send WhatsApp lead assignment notification:',
            err.message
          );
        }
      } else {
        // Use standard notification for other lead sources
        try {
          const senderPhone = await getNextAvailableNumber();
          if (senderPhone) {
            // Send WhatsApp message
            const result = await sendWhatsAppMessage({
              leadId: lead._id,
              userId: user._id,
              templateId: null,
              senderPhone: senderPhone.phoneNumber,
              recipientPhone: user.phone,
              messageContent: `A new lead (${lead.name}, ${lead.phone}) has been assigned to you in CRM.`,
            });

            // Create activity for lead assignment notification
            if (result && result.success) {
              await Activity.create({
                lead: lead._id,
                user: user._id,
                type: 'whatsapp',
                status: 'completed',
                notes: `Notification sent: New lead assignment`,
                templateUsed: null,
              });
            }
          }
        } catch (err) {
          console.error(
            'Failed to send WhatsApp assignment notification:',
            err.message
          );
        }
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
    status: { $nin: ['completed', 'cancelled'] },
  }).populate('assignedTo lead');

  for (const fu of followUps) {
    if (fu.assignedTo && fu.assignedTo.phone) {
      try {
        const senderPhone = await getNextAvailableNumber();
        if (senderPhone) {
          // Send WhatsApp message
          const result = await sendWhatsAppMessage({
            leadId: fu.lead._id,
            userId: fu.assignedTo._id,
            templateId: null,
            senderPhone: senderPhone.phoneNumber,
            recipientPhone: fu.assignedTo.phone,
            messageContent: `Reminder: You have a follow-up scheduled today for lead ${fu.lead.name} (${fu.lead.phone}) in CRM.`,
          });

          // Create activity for follow-up reminder
          if (result && result.success) {
            await Activity.create({
              lead: fu.lead._id,
              user: fu.assignedTo._id,
              type: 'whatsapp',
              status: 'completed',
              notes: `Daily follow-up reminder sent`,
              templateUsed: null,
            });
          }
        }
      } catch (err) {
        console.error(
          'Failed to send WhatsApp follow-up reminder:',
          err.message
        );
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
        $lte: fiveMinutesAhead,
      },
      status: { $nin: ['completed', 'cancelled'] },
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
          createdAt: new Date(),
        });

        // Send WhatsApp message based on lead source
        try {
          const minutesRemaining = Math.round(
            (followUp.scheduled - now) / 60000
          );
          // If it's a WhatsApp lead or follow-up type is WhatsApp, use specialized notification
          if (
            followUp.lead.source === 'whatsapp' ||
            followUp.followUpType === 'whatsapp'
          ) {
            const { sendFollowUpReminder } = await import(
              './utils/whatsappNotifications.js'
            );
            await sendFollowUpReminder(
              followUp,
              followUp.assignedTo,
              minutesRemaining
            );
          } else {
            // Use standard notification for other lead sources
            const senderPhone = await getNextAvailableNumber();
            if (senderPhone && followUp.assignedTo.phone) {
              const result = await sendWhatsAppMessage({
                leadId: followUp.lead._id,
                userId: followUp.assignedTo._id,
                templateId: null,
                senderPhone: senderPhone.phoneNumber,
                recipientPhone: followUp.assignedTo.phone,
                messageContent: `Reminder: You have a follow-up scheduled with ${followUp.lead.name} in ${minutesRemaining} minutes.`,
              });

              // Create activity for follow-up reminder to employee
              if (result && result.success) {
                await Activity.create({
                  lead: followUp.lead._id,
                  user: followUp.assignedTo._id,
                  type: 'whatsapp',
                  status: 'completed',
                  notes: `Follow-up reminder sent to employee`,
                  templateUsed: null,
                });
              }
            }
          }
        } catch (err) {
          console.error(
            'Failed to send follow-up WhatsApp message:',
            err.message
          );
        }
      }
    }
  } catch (error) {
    console.error('Error in follow-up check cron job:', error);
  }
});
