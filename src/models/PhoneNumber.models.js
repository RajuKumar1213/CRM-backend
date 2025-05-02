import mongoose from 'mongoose';

const PhoneNumberSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
      unique: true,
      trim: true,
      match: [
        /^\+\d{10,15}$/,
        'Please add a valid phone number in international format',
      ],
    },
    name: {
      type: String,
      required: [true, 'Please add a name for this number'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    provider: {
      type: String,
      enum: ['twilio', 'messagebird', 'vonage', 'other'],
      default: 'twilio',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    dailyLimit: {
      type: Number,
      default: 1000, // Default daily message limit
    },
    dailyCount: {
      type: Number,
      default: 0,
    },
    dailyCountResetDate: {
      type: Date,
      default: Date.now,
    },
    lastUsed: {
      type: Date,
    },
    addedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Method to reset daily count if needed
PhoneNumberSchema.methods.resetDailyCountIfNeeded = async function () {
  const now = new Date();
  const resetDate = this.dailyCountResetDate;

  // If it's a new day, reset the counter
  if (
    now.getDate() !== resetDate.getDate() ||
    now.getMonth() !== resetDate.getMonth() ||
    now.getFullYear() !== resetDate.getFullYear()
  ) {
    this.dailyCount = 0;
    this.dailyCountResetDate = now;
    await this.save();
  }
};

// Method to increment message count
PhoneNumberSchema.methods.incrementMessageCount = async function () {
  await this.resetDailyCountIfNeeded();

  this.messageCount += 1;
  this.dailyCount += 1;
  this.lastUsed = Date.now();
  await this.save();
};

// Check if number is within daily limit
PhoneNumberSchema.methods.isWithinDailyLimit = async function () {
  await this.resetDailyCountIfNeeded();
  return this.dailyCount < this.dailyLimit;
};

export const PhoneNumber = mongoose.model('PhoneNumber', PhoneNumberSchema);
