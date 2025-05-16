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
import mongoose from 'mongoose';

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
    throw new ApiResponse(400, 'Not any sender number is available.');
  }
  try {
    // Send message using WhatsApp service
    const result = await sendWhatsAppMessage({
      leadId: lead._id,
      userId: req.user._id,
      templateId: templateId || null,
      senderPhone: senderNumber.phoneNumber,
      recipientPhone: lead.phone,
      messageContent
    });

    if (!result || !result.success) {
      throw new ApiError(500, 'Failed to send WhatsApp message');
    }

    // Create activity record for this message
    await Activity.create({
      lead: lead._id,
      user: req.user._id,
      type: 'whatsapp',
      status: 'completed',
      notes: `WhatsApp message sent: ${messageContent.substring(0, 50)}...`,
      templateUsed: templateId || null,
    });

    // Update phone number usage stats
    await updateNumberUsage(senderNumber._id);

    // Update lead's last contacted date
    lead.lastContacted = Date.now();
    lead.lastContactMethod = 'whatsapp';
    await lead.save();    return res.status(200).json(
      new ApiResponse(
        200,
        {
          messageId: result.message.id,
          recipient: lead.phone,
          sender: senderNumber.phoneNumber,
          content: messageContent,
          template: templateName,
        },
        'WhatsApp message sent successfully.'
      )
    );
  } catch (error) {
    console.log('error sending message : ', error);
    throw new ApiError(500, 'Failed to send WhatsApp message');
  }
});

// @desc    Get all WhatsApp templates
// @route   GET /api/v1/whatsapp/templates
// @access  Private
const getWhatsappTemplates = asyncHandler(async (req, res, next) => {
  const templates = await WhatsappTemplate.find();



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
// @route   PUT /api/v1/whatsapp/update-templates/:id
// @access  Private (Admin/Manager)
const updateWhatsappTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check user role
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApiError(401, 'Not authorized to update WhatsApp templates');
  }

  // Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid WhatsApp template ID');
  }

  // Check if template exists
  const template = await WhatsappTemplate.findById(id);
  if (!template) {
    throw new ApiError(404, `WhatsApp template not found with id ${id}`);
  }

  // Validate request body
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, 'No update data provided');
  }

  // Update template
  const updatedTemplate = await WhatsappTemplate.findByIdAndUpdate(
    id,
    { $set: req.body }, // Use $set to update only provided fields
    { new: true, runValidators: true }
  );

  if (!updatedTemplate) {
    throw new ApiError(500, 'Failed to update WhatsApp template');
  }

  // Return success response
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedTemplate,
        'WhatsApp template updated successfully'
      )
    );
});

// @desc    Delete WhatsApp template
// @route   DELETE /api/v1/whatsapp/delete-template/:id
// @access  Private (Admin only)
const deleteWhatsappTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to delete WhatsApp templates');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid WhatsApp template ID');
  }

  const template = await WhatsappTemplate.findById(id);
  if (!template) {
    throw new ApiError(404, `WhatsApp template not found with id ${id}`);
  }

  await WhatsappTemplate.findByIdAndDelete(id);

  res
    .status(200)
    .json(new ApiResponse(200, {}, 'WhatsApp template deleted successfully'));
});

// @desc    Get all phone numbers for WhatsApp sending
// @route   GET /api/v1/whatsapp/phone-numbers
// @access  Private (Admin/Manager)
const getPhoneNumbers = asyncHandler(async (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApiError(401, 'Not authorized to view phone numbers');
  }

  const phoneNumbers = await PhoneNumber.find();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        count: phoneNumbers.length,
        data: phoneNumbers,
      },
      'Phone numbers retrieved successfully'
    )
  );
});

// @desc    Add a phone number for WhatsApp sending
// @route   POST /api/v1/whatsapp/phone-numbers
// @access  Private (Admin only)
const addPhoneNumber = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to add phone numbers');
  }

  const phoneRegex = /^\+\d{10,15}$/;
  if (!phoneRegex.test(req.body.phoneNumber)) {
    throw new ApiError(
      400,
      'Phone number must be in international format (e.g., +91XXXXXXXXXX)'
    );
  }

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

  res
    .status(201)
    .json(new ApiResponse(201, phoneNumber, 'Phone number added successfully'));
});

// @desc    Update a phone number for WhatsApp sending
// @route   PUT /api/v1/whatsapp/phone-numbers/:id
// @access  Private (Admin only)
const updatePhoneNumber = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to update phone numbers');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid phone number ID');
  }

  const phoneNumber = await PhoneNumber.findById(id);
  if (!phoneNumber) {
    throw new ApiError(404, `Phone number not found with id ${id}`);
  }

  if (req.body.phoneNumber) {
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(req.body.phoneNumber)) {
      throw new ApiError(
        400,
        'Phone number must be in international format (e.g., +91XXXXXXXXXX)'
      );
    }

    if (req.body.phoneNumber !== phoneNumber.phoneNumber) {
      const existingNumber = await PhoneNumber.findOne({
        phoneNumber: req.body.phoneNumber,
      });
      if (existingNumber) {
        throw new ApiError(400, 'This phone number is already registered');
      }
    }
  }

  const updatedPhoneNumber = await PhoneNumber.findByIdAndUpdate(
    id,
    { $set: req.body },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!updatedPhoneNumber) {
    throw new ApiError(500, 'Failed to update phone number');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPhoneNumber,
        'Phone number updated successfully'
      )
    );
});

// @desc    Delete a phone number for WhatsApp sending
// @route   DELETE /api/v1/whatsapp/phone-numbers/:id
// @access  Private (Admin only)
const deletePhoneNumber = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to delete phone numbers');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid phone number ID');
  }

  const phoneNumber = await PhoneNumber.findById(id);
  if (!phoneNumber) {
    throw new ApiError(404, `Phone number not found with id ${id}`);
  }

  await PhoneNumber.findByIdAndDelete(id);

  res
    .status(200)
    .json(new ApiResponse(200, {}, 'Phone number deleted successfully'));
});

// @desc    Get WhatsApp message history for a lead
// @route   GET /api/v1/whatsapp/history/:leadId
// @access  Private
const getMessageHistory = asyncHandler(async (req, res) => {
  const { leadId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    throw new ApiError(400, 'Invalid lead ID');
  }

  const lead = await Lead.findById(leadId);
  if (!lead) {
    throw new ApiError(404, `Lead not found with id ${leadId}`);
  }

  if (
    lead.assignedTo.toString() !== req.user._id &&
    req.user.role !== 'admin'
  ) {
    throw new ApiError(
      401,
      `User ${req.user._id} is not authorized to view message history for this lead`
    );
  }

  const messageHistory = await Activity.find({
    lead: lead._id,
    type: 'whatsapp',
  }).sort('-createdAt');

  res.status(200).json(
    new ApiResponse(
      200,
      {
        count: messageHistory.length,
        data: messageHistory,
      },
      'Message history retrieved successfully'
    )
  );
});

// @desc    Get WhatsApp usage stats
// @route   GET /api/v1/whatsapp/stats
// @access  Private (Admin/Manager)
const getWhatsappStats = asyncHandler(async (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    throw new ApiError(401, 'Not authorized to view WhatsApp stats');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(
    startDate.getDate() - (req.query.days ? parseInt(req.query.days) : 30)
  );

  const messagesByDay = await Activity.aggregate([
    {
      $match: {
        type: 'whatsapp',
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const messagesByUser = await Activity.aggregate([
    {
      $match: {
        type: 'whatsapp',
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
    { $unwind: '$userDetails' },
    {
      $project: {
        _id: 1,
        count: 1,
        name: '$userDetails.name',
        email: '$userDetails.email',
      },
    },
    { $sort: { count: -1 } },
  ]);

  const messagesByTemplate = await Activity.aggregate([
    {
      $match: {
        type: 'whatsapp',
        templateUsed: { $ne: null },
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$templateUsed', // 👈 Reference the field correctly
        count: { $sum: 1 },
      },
    },
    {
      $sort: { count: -1 },
    },
    {
      $lookup: {
        from: 'whatsapptemplates', // ⚠️ collection name in lowercase plural usually
        localField: '_id',
        foreignField: '_id',
        as: 'template',
      },
    },
    {
      $unwind: '$template',
    },
    {
      $project: {
        _id: 0,
        templateId: '$_id',
        count: 1,
        templateName: '$template.name',
        description: '$template.description',
      },
    },
  ]);

  const phoneNumberUsage = await PhoneNumber.find()
    .select('phoneNumber name messageCount isActive lastUsed')
    .sort('-messageCount');

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalMessages: await Activity.countDocuments({
          type: 'whatsapp',
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        messagesByDay,
        messagesByUser,
        messagesByTemplate,
        phoneNumberUsage,
      },
      'WhatsApp stats retrieved successfully'
    )
  );
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
