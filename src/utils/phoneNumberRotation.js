/**
 * Phone Number Rotation Service
 * Handles the rotation of phone numbers for WhatsApp message sending
 */

import { PhoneNumber } from '../models/PhoneNumber.models.js';
import { CompanySetting } from '../models/CompanySettings.models.js';
import { ApiError } from './ApiError.js';

/**
 * Get the next available phone number based on rotation strategy
 * @returns {Object} Phone number document or null if none available
 */
export const getNextAvailableNumber = async (companyId) => {
  try {
    // 1. Get company settings
    const companySettings = await CompanySetting.findOne();

    if (!companySettings || !companySettings.numberRotationEnabled) {
      throw new ApiError(
        400,
        'Phone number rotation is not enabled for this company'
      );
    }

    const rotationStrategy = companySettings.rotationStrategy || 'round-robin'; // add this field to schema if needed

    // 2. Get active phone numbers for this company
    const activeNumbers = await PhoneNumber.find({
      companyId,
      isActive: true,
    });

    console.log(activeNumbers, 'available phone');

    if (!activeNumbers.length) {
      console.error('No active phone numbers available for this company');
      return null;
    }

    // 3. Reset daily counts if needed
    for (const number of activeNumbers) {
      await number.resetDailyCountIfNeeded();
    }

    // 4. Filter out numbers that exceeded their daily limit
    const availableNumbers = activeNumbers.filter(
      (num) => num.dailyCount < num.dailyLimit
    );

    if (!availableNumbers.length) {
      console.error('All numbers hit daily limit');
      return null;
    }

    // 5. Rotation logic
    let selectedNumber;
    switch (rotationStrategy) {
      case 'least-used-today':
        availableNumbers.sort((a, b) => a.dailyCount - b.dailyCount);
        selectedNumber = availableNumbers[0];
        break;

      case 'least-used-overall':
        availableNumbers.sort((a, b) => a.messageCount - b.messageCount);
        selectedNumber = availableNumbers[0];
        break;

      case 'random':
        selectedNumber =
          availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
        break;

      case 'round-robin':
      default:
        availableNumbers.sort((a, b) => {
          if (!a.lastUsed) return -1;
          if (!b.lastUsed) return 1;
          return a.lastUsed - b.lastUsed;
        });
        selectedNumber = availableNumbers[0];
        break;
    }

    // 6. Prefer default number if it exists and allowed
    const defaultNumber = availableNumbers.find(
      (num) => num.isDefault && num.dailyCount < num.dailyLimit
    );
    if (defaultNumber && companySettings.preferDefaultNumber) {
      selectedNumber = defaultNumber;
    }

    return selectedNumber;
  } catch (err) {
    throw new ApiError(500, 'Error getting next available number');
  }
};

/**
 * Update the usage statistics for a phone number after sending a message
 * @param {String} phoneNumberId - ID of the phone number used
 * @returns {Object} Updated phone number document
 */
export const updateNumberUsage = async (phoneNumberId) => {
  try {
    const phoneNumber = await PhoneNumber.findById(phoneNumberId);

    if (!phoneNumber) {
      throw new Error(`Phone number with ID ${phoneNumberId} not found`);
    }

    await phoneNumber.incrementMessageCount();
    return phoneNumber;
  } catch (error) {
    console.error('Error updating phone number usage:', error);
    throw error;
  }
};

/**
 * Reset the daily count for all phone numbers
 * Used for manual reset or scheduled tasks
 * @returns {Object} Result of the operation
 */
export const resetAllDailyCounts = async () => {
  try {
    const phoneNumbers = await PhoneNumber.find();

    for (const phoneNumber of phoneNumbers) {
      phoneNumber.dailyCount = 0;
      phoneNumber.dailyCountResetDate = new Date();
      await phoneNumber.save();
    }

    return {
      success: true,
      message: 'Reset daily counts for all phone numbers',
    };
  } catch (error) {
    console.error('Error resetting phone number daily counts:', error);
    throw error;
  }
};

/**
 * Get phone number usage statistics
 * @param {Date} startDate - Start date for statistics
 * @param {Date} endDate - End date for statistics
 * @returns {Array} Array of phone number usage statistics
 */
export const getUsageStatistics = async (startDate, endDate) => {
  try {
    // Get all phone numbers
    const phoneNumbers = await PhoneNumber.find().select(
      'phoneNumber name messageCount dailyCount isActive lastUsed'
    );

    return {
      success: true,
      data: phoneNumbers,
    };
  } catch (error) {
    console.error('Error getting phone number usage statistics:', error);
    throw error;
  }
};

/**
 * Set a phone number as default for sending messages
 * @param {String} phoneNumberId - ID of the phone number to set as default
 * @returns {Object} Updated phone number document
 */
export const setDefaultNumber = async (phoneNumberId) => {
  try {
    // First, unset any existing default number
    await PhoneNumber.updateMany({ isDefault: true }, { isDefault: false });

    // Set the new default number
    const phoneNumber = await PhoneNumber.findByIdAndUpdate(
      phoneNumberId,
      { isDefault: true },
      { new: true }
    );

    if (!phoneNumber) {
      throw new Error(`Phone number with ID ${phoneNumberId} not found`);
    }

    return phoneNumber;
  } catch (error) {
    console.error('Error setting default phone number:', error);
    throw error;
  }
};
