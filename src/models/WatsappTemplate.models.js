import mongoose from 'mongoose';

const WhatsappTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a template name'],
      trim: true,
      maxlength: [50, 'Template name cannot be more than 50 characters'],
    },
    description: {
      type: String,
      maxlength: [200, 'Description cannot be more than 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Please add template content'],
      maxlength: [4096, 'Template content cannot be more than 4096 characters'],
    },
    category: {
      type: String,
      enum: [
        'greeting',
        'follow-up',
        'reminder',
        'promotion',
        'information',
        'other',
      ],
      default: 'follow-up',
    },
    tags: [String],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for searching templates
WhatsappTemplateSchema.index({ name: 'text', content: 'text', tags: 'text' });

// Auto-increment usage count when template is used
WhatsappTemplateSchema.methods.incrementUsage = async function () {
  this.usageCount += 1;
  await this.save();
};

export const WhatsappTemplate = mongoose.model(
  'WhatsappTemplate',
  WhatsappTemplateSchema
);
