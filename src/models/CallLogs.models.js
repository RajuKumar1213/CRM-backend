import mongoose from 'mongoose';

const CallLogSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.ObjectId,
    ref: 'Lead',
    required: true,
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  callType: {
    type: String,
    enum: ['outgoing', 'incoming'],
    default: 'outgoing',
  },
  status: {
    type: String,
    enum: ['connected', 'missed', 'busy', 'failed', 'voicemail'],
    required: true,
  },
  duration: {
    type: Number,
    default: 0,
    comment: 'Duration in seconds',
  },
  recordingUrl: {
    type: String,
  },
  notes: {
    type: String,
  },
  calledFrom: {
    type: String,
    match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
  },
  calledTo: {
    type: String,
    required: [true, 'Please add a recipient phone number'],
    match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CallLogSchema.index({ lead: 1, startTime: -1 });
CallLogSchema.index({ user: 1, startTime: -1 });

export const CallLog = mongoose.model('CallLog', CallLogSchema);
