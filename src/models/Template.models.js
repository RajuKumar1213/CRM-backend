import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a template name'],
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['whatsapp', 'email', 'sms'],
      default: 'whatsapp',
    },
    content: {
      type: String,
      required: [true, 'Please add template content'],
    },
    variables: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Template = mongoose.model('Template', TemplateSchema);
