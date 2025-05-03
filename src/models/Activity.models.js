import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: ['call', 'whatsapp', 'email', 'meeting', 'note'],
      required: true,
    },
    status: {
      type: String,
      enum: ['attempted', 'connected', 'not-answered', 'completed', 'other'],
      default: 'completed',
    },
    duration: {
      type: Number,
      comment: 'Duration in seconds, applicable for calls',
    },
    notes: {
      type: String,
    },
    templateUsed: {
      type: mongoose.Schema.ObjectId,
      ref: 'WhatsappTemplate',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
ActivitySchema.index({ lead: 1, createdAt: -1 });
ActivitySchema.index({ user: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', ActivitySchema);
