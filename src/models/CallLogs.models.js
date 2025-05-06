import mongoose from 'mongoose';

const CallLogSchema = new mongoose.Schema({
  // Individual call fields
  lead: {
    type: mongoose.Schema.ObjectId,
    ref: 'Lead',
    required: function () {
      return !this.isQueue; // Required for calls, not queues
    },
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: function () {
      return !this.isQueue; // Required for calls, not queues
    },
  },
  callType: {
    type: String,
    enum: ['outgoing', 'incoming'],
    default: 'outgoing',
    required: function () {
      return !this.isQueue;
    },
  },
  status: {
    type: String,
    enum: [
      'initiated',
      'ringing',
      'connected',
      'missed',
      'busy',
      'failed',
      'voicemail',
    ],
    required: function () {
      return !this.isQueue;
    },
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
    required: function () {
      return !this.isQueue;
    },
  },
  calledTo: {
    type: String,
    match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
    required: function () {
      return !this.isQueue;
    },
  },
  startTime: {
    type: Date,
    default: function () {
      return this.isQueue ? null : Date.now;
    },
  },
  endTime: {
    type: Date,
  },
  callSid: {
    type: String,
  },
  followUpScheduled: {
    type: Boolean,
    default: false,
  },
  // Queue-specific fields
  isQueue: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    required: function () {
      return this.isQueue;
    },
  },
  description: {
    type: String,
  },
  leads: [
    {
      lead: {
        type: mongoose.Schema.ObjectId,
        ref: 'Lead',
        required: true,
      },
      priority: {
        type: Number,
        default: 5,
        min: 1,
        max: 10,
      },
      status: {
        type: String,
        enum: ['pending', 'scheduled', 'called', 'completed', 'failed'],
        default: 'pending',
      },
      attempts: {
        type: Number,
        default: 0,
      },
      lastAttempt: {
        type: Date,
      },
      nextAttempt: {
        type: Date,
      },
    },
  ],
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: function () {
      return this.isQueue;
    },
  },
  assignedAgents: [
    {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
  ],
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CallLogSchema.index({ lead: 1, startTime: -1 });
CallLogSchema.index({ user: 1, startTime: -1 });
CallLogSchema.index({ isQueue: 1, createdBy: 1 });

export const CallLog = mongoose.model('CallLog', CallLogSchema);
