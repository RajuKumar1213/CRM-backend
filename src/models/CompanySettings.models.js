import mongoose from 'mongoose';

const CompanySettingSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Please add a company name'],
      trim: true,
    },
    logo: {
      type: String,
    },
    contactNumbers: [
      {
        type: String,
        match: [/^\+?[0-9]{10,15}$/, 'Please add valid phone numbers'],
      },
    ],
    whatsappApiKey: {
      type: String,
    },
    whatsappApiProvider: {
      type: String,
      enum: ['360dialog', 'twilio', 'gupshup', 'wati', 'other'],
    },
    whatsappApiUrl: {
      type: String,
    },
    leadRotationEnabled: {
      type: Boolean,
      default: true,
    },
    numberRotationEnabled: {
      type: Boolean,
      default: true,
    },
    autoFollowupEnabled: {
      type: Boolean,
      default: true,
    },
    defaultFollowupIntervals: {
      new: { type: Number, default: 1 },
      contacted: { type: Number, default: 2 },
      qualified: { type: Number, default: 3 },
      proposal: { type: Number, default: 5 },
      negotiation: { type: Number, default: 2 },
    },
  },
  {
    timestamps: true,
  }
);

export const CompanySetting = mongoose.model(
  'CompanySetting',
  CompanySettingSchema
);
