import {CompanySetting} from '../models/CompanySettings.models.js';
import { ApiError } from './ApiError.js';

/**
 * Get the next contact number to use for outreach
 * @param {String} leadId - The ID of the lead to contact
 * @returns {Promise<String>} - The phone number to use
 */
export const getNextContactNumber = async (leadId) => {
  try {
    // Get company settings
    const settings = await CompanySetting.findOne();

    if (
      !settings ||
      !settings.contactNumbers ||
      settings.contactNumbers.length === 0
    ) {
      throw new ApiError(404, 'No contact numbers configured');
    }

    // If number rotation is disabled, return the first number
    if (!settings.numberRotationEnabled) {
      return settings.contactNumbers[0];
    }

    // Simple algorithm to rotate numbers based on lead ID
    const leadObjectId = mongoose.Types.ObjectId(leadId);
    const leadIdNumber = parseInt(leadObjectId.toString().substring(0, 8), 16);
    const numberIndex = leadIdNumber % settings.contactNumbers.length;

    console.log(leadObjectId, leadIdNumber, numberIndex);

    return settings.contactNumbers[numberIndex];
  } catch (error) {
    console.error('Error in number rotation:', error);
    throw error;
  }
};
