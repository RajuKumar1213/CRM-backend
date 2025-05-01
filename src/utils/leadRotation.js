import { User } from '../models/User.models.js';
import { Lead } from '../models/Lead.models.js';
import { Notification } from '../models/Notification.models.js';
import { ApiError } from './ApiError.js';
import { ApiResponse } from './ApiResponse.js';

/** 
 * Auto-rotate leads among employees
 * @param {Object} lead - The lead object to be assigned
 * @returns {Promise<Object>} - Assigned user
 */
export const assignLeadToNextEmployee = async (lead) => {
  try {
    // Get all active sales employees
    const employees = await User.find({
      role: 'employee',
      // You can add additional filters here based on your business logic
      // such as active status, department, etc.
    }).sort('lastLeadAssigned');

    if (employees.length === 0) {
      throw new ApiError(404, 'No active sales employees found.');
    }

    // Get the employee who has not been assigned a lead for the longest time
    const nextEmployee = employees[0];

    // Update the employee's last lead assignment time
    await User.findByIdAndUpdate(nextEmployee._id, {
      lastLeadAssigned: Date.now(),
    });

    // Assign lead to the employee
    lead.assignedTo = nextEmployee._id;

    // Create notification for the employee
    await Notification.create({
      user: nextEmployee._id,
      title: 'New Lead Assigned',
      message: `A new lead (${lead.name}) has been assigned to you.`,
      type: 'assignment',
      relatedTo: lead._id,
      onModel: 'Lead',
    });

    return nextEmployee;
  } catch (error) {
    console.error('Error in lead rotation:', error);
    throw error;
  }
};
