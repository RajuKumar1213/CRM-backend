import { User } from '../models/User.models.js';
import { Notification } from '../models/Notification.models.js';
import { ApiError } from './ApiError.js';

/**
 * Auto-rotate leads among employees
 * @param {Object} lead - The lead object to be assigned
 * @returns {Promise<Object>} - Assigned user
 */
export const assignLeadToNextEmployee = async () => {
  try {
    const employees = await User.find({ role: 'employee' }).sort(
      'lastLeadAssigned'
    );

    if (employees.length === 0) {
      throw new ApiError(404, 'No active sales employees found.');
    }

    const nextEmployee = employees[0];

    await User.findByIdAndUpdate(nextEmployee._id, {
      lastLeadAssigned: Date.now(),
    });

    return nextEmployee;
  } catch (error) {
    console.error('Error in lead rotation:', error);
    throw error;
  }
};
