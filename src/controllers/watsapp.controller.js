// const ErrorResponse = require('../utils/errorResponse');
// const asyncHandler = require('../middleware/async');
// const Lead = require('../models/Lead');
// const User = require('../models/User');
// const WhatsappTemplate = require('../models/WhatsappTemplate');
// const PhoneNumber = require('../models/PhoneNumber');
// const Activity = require('../models/Activity');
// const whatsappService = require('../utils/whatsappService');
// const phoneNumberRotationService = require('../utils/phoneNumberRotationService');

import { ApiError } from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { Lead } from '../models/Lead.models.js';
import { User } from '../models/User.models.js';
import { WhatsappTemplate } from '../models/WatsappTemplate.models.js';
import { PhoneNumber } from '../models/PhoneNumber.models.js';
import { Activity } from '../models/Activity.models.js';
import { sendWhatsAppMessage } from '../utils/watsappService.js';
import {
  getNextAvailableNumber,
  updateNumberUsage,
} from '../utils/phoneNumberRotation.js';

// @desc    Send WhatsApp message to a lead
// @route   POST /api/v1/whatsapp/send/:leadId
// @access  Private
const sendWhatsappMessage = asyncHandler(async (req, res, next) => {
  const { message, templateId } = req.body;
  const { leadId } = req.params;

  if (!message && !templateId) {
    throw new ApiError(400, 'Message or templateId is required');
  }

  const lead = await Lead.findById(leadId);

  if (!lead) {
    throw new ApiError(404, `No lead found with id ${leadId}`);
  }

  // Check authorization - user must be lead owner or admin
  if (!lead.assignedTo.equals(req.user._id) && req.user.role !== 'admin') {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to send WhatsApp message to this lead`
    );
  }

  // Make sure lead has a phone number
  if (!lead.phone) {
    throw new ApiError(400, 'Lead must have a phone number');
  }

  let messageContent = message;
  let templateName = null;

  // If using template, get the template content
  if (templateId) {
    const template = await WhatsappTemplate.findById(templateId);
    if (!template) {
      throw new ApiError(404, `No template found with id ${templateId}`);
    }

    // Replace placeholders in template
    messageContent = template.content
      .replace(/\{\{Customer_Name\}\}/g, lead.name || 'Customer')
      .replace(/\{\{Employee_Name\}\}/g, req.user.name)
      .replace(/\{\{Company_Name\}\}/g, lead.company || 'your company')
      .replace(/\{\{Service_Name\}\}/g, lead.interestedIn || 'our services');

    templateName = template.name;
  }

  // Get the next phone number to use through rotation
  const senderNumber = await getNextAvailableNumber();

  if (!senderNumber) {
    return next(new ErrorResponse('No available sender phone numbers', 400));
  }

  try {
    // Send message using WhatsApp service
    const result = await sendWhatsAppMessage(
      lead._id,
      req.user._id,
      templateId,
      senderNumber.phoneNumber,
      lead.phone,
      messageContent
    );

    if (!result) {
      throw new ApiError(500, 'Failed to send WhatsApp message');
    }

    // Update phone number usage stats
    await updateNumberUsage(senderNumber._id);

    // Update lead's last contacted date
    lead.lastContacted = Date.now();
    lead.lastContactMethod = 'whatsapp';
    await lead.save();

    res.status(200).json({
      success: true,
      data: {
        messageId: result.id,
        recipient: lead.phone,
        sender: senderNumber.phoneNumber,
        content: messageContent,
        template: templateName,
      },
    });
  } catch (error) {
    console.error('WhatsApp API Error:', error);
    return next(
      new ErrorResponse(
        `Failed to send WhatsApp message: ${error.message}`,
        500
      )
    );
  }
});

// @desc    Get all WhatsApp templates
// @route   GET /api/v1/whatsapp/templates
// @access  Private
const getWhatsappTemplates = asyncHandler(async (req, res, next) => {
  const templates = await WhatsappTemplate.find();

  res.status(200).json({
    success: true,
    count: templates.length,
    data: templates,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { count: templates.length, templates },
        'Templates fetched successfully.'
      )
    );
});

// @desc    Get single WhatsApp template
// @route   GET /api/v1/whatsapp/templates/:id
// @access  Private
const getWhatsappTemplate = asyncHandler(async (req, res, next) => {
  const { templateId } = req.params;
  const template = await WhatsappTemplate.findById(templateId);

  if (!template) {
    throw new ApiError(404, `No template found with id ${templateId}`);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, template, 'Template fetched successfully.'));
});

// @desc    Create WhatsApp template
// @route   POST /api/v1/whatsapp/templates
// @access  Private (Admin/Manager)
//
const createWhatsappTemplate = asyncHandler(async (req, res, next) => {
  // Only admin and manager can create templates
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApiError(401, 'Not authorized to create WhatsApp templates');
  }

  // Add creator info
  req.body.createdBy = req.user._id;

  const template = await WhatsappTemplate.create(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, template, 'Template created successfully.'));
});

// @desc    Update WhatsApp template
// @route   PUT /api/v1/whatsapp/templates/:id
// @access  Private (Admin/Manager)
const updateWhatsappTemplate = asyncHandler(async (req, res, next) => {
  // Only admin and manager can update templates
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(
      new ErrorResponse('Not authorized to update WhatsApp templates', 401)
    );
  }

  let template = await WhatsappTemplate.findById(req.params.id);

  if (!template) {
    return next(
      new ErrorResponse(`No template found with id ${req.params.id}`, 404)
    );
  }

  template = await WhatsappTemplate.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: template,
  });
});

// @desc    Delete WhatsApp template
// @route   DELETE /api/v1/whatsapp/templates/:id
// @access  Private (Admin only)
const deleteWhatsappTemplate = asyncHandler(async (req, res, next) => {
  // Only admin can delete templates
  if (req.user.role !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to delete WhatsApp templates', 401)
    );
  }

  const template = await WhatsappTemplate.findById(req.params.id);

  if (!template) {
    return next(
      new ErrorResponse(`No template found with id ${req.params.id}`, 404)
    );
  }

  await template.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get all phone numbers for WhatsApp sending
// @route   GET /api/v1/whatsapp/phone-numbers
// @access  Private (Admin/Manager)
const getPhoneNumbers = asyncHandler(async (req, res, next) => {
  // Only admin and manager can view phone numbers
  if (!['admin', 'manager'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to view phone numbers', 401));
  }

  const phoneNumbers = await PhoneNumber.find();

  res.status(200).json({
    success: true,
    count: phoneNumbers.length,
    data: phoneNumbers,
  });
});

// @desc    Add a phone number for WhatsApp sending
// @route   POST /api/v1/whatsapp/phone-numbers
// @access  Private (Admin only)
const addPhoneNumber = asyncHandler(async (req, res) => {
  // Only admin can add phone numbers
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to add phone numbers');
  }

  // Validate phone number format
  const phoneRegex = /^\+\d{10,15}$/;
  if (!phoneRegex.test(req.body.phoneNumber)) {
    throw new ApiError(
      400,
      'Phone number must be in international format (e.g.+91XXXXXXXXXX)'
    );
  }

  // Check if phone number already exists
  const existingNumber = await PhoneNumber.findOne({
    phoneNumber: req.body.phoneNumber,
  });
  if (existingNumber) {
    throw new ApiError(400, 'This phone number is already registered');
  }

  const phoneNumber = await PhoneNumber.create({
    phoneNumber: req.body.phoneNumber,
    name: req.body.name || 'WhatsApp Number',
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    addedBy: req.user._id,
  });

  return res
    .status(201)
    .json(
      new ApiResponse(201, phoneNumber, 'Phone number added successfully!')
    );
});

// @desc    Update a phone number for WhatsApp sending
// @route   PUT /api/v1/whatsapp/phone-numbers/:id
// @access  Private (Admin only)
const updatePhoneNumber = asyncHandler(async (req, res, next) => {
  // Only admin can update phone numbers
  if (req.user.role !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to update phone numbers', 401)
    );
  }

  let phoneNumber = await PhoneNumber.findById(req.params.id);

  if (!phoneNumber) {
    return next(
      new ErrorResponse(`No phone number found with id ${req.params.id}`, 404)
    );
  }

  // If updating the phone number itself, validate the format
  if (req.body.phoneNumber) {
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(req.body.phoneNumber)) {
      return next(
        new ErrorResponse(
          'Phone number must be in international format (e.g., +91XXXXXXXXXX)',
          400
        )
      );
    }

    // Check if new number already exists (if different from current)
    if (req.body.phoneNumber !== phoneNumber.phoneNumber) {
      const existingNumber = await PhoneNumber.findOne({
        phoneNumber: req.body.phoneNumber,
      });
      if (existingNumber) {
        return next(
          new ErrorResponse('This phone number is already registered', 400)
        );
      }
    }
  }

  phoneNumber = await PhoneNumber.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: phoneNumber,
  });
});

// @desc    Delete a phone number for WhatsApp sending
// @route   DELETE /api/v1/whatsapp/phone-numbers/:id
// @access  Private (Admin only)
const deletePhoneNumber = asyncHandler(async (req, res, next) => {
  // Only admin can delete phone numbers
  if (req.user.role !== 'admin') {
    return next(
      new ErrorResponse('Not authorized to delete phone numbers', 401)
    );
  }

  const phoneNumber = await PhoneNumber.findById(req.params.id);

  if (!phoneNumber) {
    return next(
      new ErrorResponse(`No phone number found with id ${req.params.id}`, 404)
    );
  }

  await phoneNumber.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get WhatsApp message history for a lead
// @route   GET /api/v1/whatsapp/history/:leadId
// @access  Private
const getMessageHistory = asyncHandler(async (req, res, next) => {
  const lead = await Lead.findById(req.params.leadId);

  if (!lead) {
    return next(
      new ErrorResponse(`No lead found with id ${req.params.leadId}`, 404)
    );
  }

  // Check authorization - user must be lead owner or admin
  if (lead.assignedTo.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to view message history for this lead`,
        401
      )
    );
  }

  // Get WhatsApp message activities for this lead
  const messageHistory = await Activity.find({
    lead: lead._id,
    action: 'whatsapp-sent',
  }).sort('-createdAt');

  res.status(200).json({
    success: true,
    count: messageHistory.length,
    data: messageHistory,
  });
});

// @desc    Get WhatsApp usage stats
// @route   GET /api/v1/whatsapp/stats
// @access  Private (Admin/Manager)
const getWhatsappStats = asyncHandler(async (req, res) => {
  // Only admin and manager can view stats
  if (!['admin', 'manager'].includes(req.user.role)) {
   throw new ApiError(401, 'Not authorized to view WhatsApp stats')
  }

  // Get start and end dates from query or default to last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(
    startDate.getDate() - (req.query.days ? parseInt(req.query.days) : 30)
  );

  // Get message count by day
  const messagesByDay = await Activity.aggregate([
    {
      $match: {
        action: 'whatsapp-sent',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);

  // Get message count by user
  const messagesByUser = await Activity.aggregate([
    {
      $match: {
        action: 'whatsapp-sent',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$user',
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails',
      },
    },
    {
      $unwind: '$userDetails',
    },
    {
      $project: {
        _id: 1,
        count: 1,
        name: '$userDetails.name',
        email: '$userDetails.email',
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  // Get message count by template
  const messagesByTemplate = await Activity.aggregate([
    {
      $match: {
        action: 'whatsapp-sent',
        'metadata.templateUsed': { $ne: null },
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$metadata.templateUsed',
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);

  // Get phone number usage
  const phoneNumberUsage = await PhoneNumber.find()
    .select('phoneNumber name messageCount isActive lastUsed')
    .sort('-messageCount');

 

  return res.status(200).json(
    new ApiResponse(200, {
      totalMessages: await Activity.countDocuments({
        action: 'whatsapp-sent',
        createdAt: { $gte: startDate, $lte: endDate },
      }),
      messagesByDay,
      messagesByUser,
      messagesByTemplate,
      phoneNumberUsage,
    }, "WhatsApp stats fetched successfully.")
  )
});

export {
  sendWhatsappMessage,
  getWhatsappTemplates,
  getWhatsappStats,
  getMessageHistory,
  deletePhoneNumber,
  updatePhoneNumber,
  addPhoneNumber,
  getPhoneNumbers,
  deleteWhatsappTemplate,
  updateWhatsappTemplate,
  createWhatsappTemplate,
  getWhatsappTemplate,
};
