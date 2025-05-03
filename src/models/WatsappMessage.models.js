import mongoose from 'mongoose';

const WhatsAppMessageSchema = new mongoose.Schema({
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
  template: {
    type: mongoose.Schema.ObjectId,
    ref: 'WhatsappTemplate',
  },
  content: {
    type: String,
    required: [true, 'Please add message content'],
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'read', 'failed'],
    default: 'queued',
  },
  error: {
    type: String,
  },
  sentFrom: {
    type: String,
    match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
  },
  sentTo: {
    type: String,
    required: [true, 'Please add a recipient phone number'],
    match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
  },
  messageId: {
    type: String,
    comment: 'WhatsApp Business API message ID',
  },
  sentAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
  readAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for faster queries
WhatsAppMessageSchema.index({ lead: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ user: 1, createdAt: -1 });
WhatsAppMessageSchema.index({ status: 1 });

export const WhatsAppMessage = mongoose.model(
  'WhatsAppMessage',
  WhatsAppMessageSchema
);
