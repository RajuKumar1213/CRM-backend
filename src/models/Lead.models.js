import mongoose from 'mongoose';

const LeadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Please add a phone number'],
      match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
    },
    product: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      enum: ['whatsapp'],
      default: 'whatsapp',
    },
    message: {
      type: String,
    },
    status: {
      type: String,
      enum: [
        'new',
        'in-progress',
        'won',
        'lost'
      ],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    notes: {
      type: String,
    },
    assignedTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
    },
    messageSid: { type: String },
    contactedWith: {
      type: String,
      match: [/^\+?[0-9]{10,15}$/, 'Please add a valid phone number'],
    },
    lastContacted: {
      type: Date,
    },
    lastContactMethod: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create index for faster queries
LeadSchema.index({ assignedTo: 1, status: 1 });
LeadSchema.index({ phone: 1 });

// Reverse populate with virtuals
LeadSchema.virtual('followUps', {
  ref: 'FollowUp',
  localField: '_id',
  foreignField: 'lead',
  justOne: false,
});

LeadSchema.virtual('activities', {
  ref: 'Activity',
  localField: '_id',
  foreignField: 'lead',
  justOne: false,
});

export const Lead = mongoose.model('Lead', LeadSchema);
