import mongoose from 'mongoose';

const FollowUpSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.ObjectId,
    ref: 'Lead',
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  scheduled: {
    type: Date,
    required: [true, 'Please add a scheduled date for follow-up'],
  },
  followUpType: {
    type: String,
    enum: ['call', 'whatsapp'],
    default: 'call',
  },
  status: {
    type: String,
    enum: [
      'new',
      'contacted',
      'qualified',
      'negotiating',
      'in-progress',
      'proposal-sent',
      'won',
      'lost',
      'on-hold'
    ],
    default: 'new',
  },
  notes: {
    type: String,
  },
  outcome: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
  },
  interval: {
    type: Number,
    default: 2,
    comment: 'Follow up interval in days',
  },
});

// Create index for faster queries
FollowUpSchema.index({ assignedTo: 1, scheduled: 1, status: 1 });
FollowUpSchema.index({ lead: 1 });

export const FollowUp = mongoose.model('FollowUp', FollowUpSchema);
