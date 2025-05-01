import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please add a notification title'],
    },
    message: {
      type: String,
      required: [true, 'Please add a notification message'],
    },
    type: {
      type: String,
      enum: ['followup', 'assignment', 'system', 'other'],
      default: 'followup',
    },
    relatedTo: {
      type: mongoose.Schema.ObjectId,
      refPath: 'onModel',
    },
    onModel: {
      type: String,
      enum: ['Lead', 'FollowUp', 'User'],
      required: function () {
        return this.relatedTo !== undefined;
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Create index for faster queries
NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', NotificationSchema);
