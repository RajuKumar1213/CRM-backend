import mongoose from 'mongoose';
import { CompanySetting } from '../models/CompanySettings.models.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * @desc    Get all company settings
 * @route   GET /api/company-settings
 * @access  Private/Admin
 */
export const getCompanySettings = asyncHandler(async (req, res) => {
  const companySettings = await CompanySetting.find({});

  if (!companySettings || companySettings.length === 0) {
    throw new ApiError(404, 'No company settings found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companySettings,
        'Company settings retrieved successfully'
      )
    );
});

/**
 * @desc    Get single company setting by ID
 * @route   GET /api/company-settings/:id
 * @access  Private/Admin
 */
export const getCompanySettingById = asyncHandler(async (req, res) => {
  const companySetting = await CompanySetting.findById(req.params.id);

  if (companySetting) {
    res.status(200).json(companySetting);
  } else {
    res.status(404);
    throw new Error('Company setting not found');
  }
});

/**
 * @desc    Create new company setting
 * @route   POST /api/company-settings
 * @access  Private/Admin
 */
export const createCompanySetting = asyncHandler(async (req, res) => {
  const {
    companyName,
    logo,
    contactNumbers,
    whatsappApiProvider,
    whatsappApiUrl,
    leadRotationEnabled,
    numberRotationEnabled,
    autoFollowupEnabled,
    defaultFollowupIntervals,
  } = req.body;

  // Validate required fields
  if (!companyName) {
    throw new ApiError(400, 'Company name is required');
  }

  // Check if company setting already exists
  const companySettingExists = await CompanySetting.findOne({ companyName });
  if (companySettingExists) {
    throw new ApiError(400, 'Company setting with this name already exists');
  }

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to create company setting');
  }

  // Create new company setting
  const companySetting = await CompanySetting.create({
    companyName,
    logo,
    contactNumbers: contactNumbers || [],
    whatsappApiProvider: whatsappApiProvider || 'twilio', // Default to twilio
    whatsappApiUrl,
    leadRotationEnabled: leadRotationEnabled,
    numberRotationEnabled: numberRotationEnabled,
    autoFollowupEnabled: autoFollowupEnabled,
    defaultFollowupIntervals: defaultFollowupIntervals || [],
  });

  if (!companySetting) {
    throw new ApiError(
      400,
      'Failed to create company setting due to invalid data'
    );
  }

  // Return success response
  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        companySetting,
        'Company setting created successfully'
      )
    );
});

/**
 * @desc    Update company setting
 * @route   PUT /api/company-settings/:id
 * @access  Private/Admin
 */
export const updateCompanySetting = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  // Check if company setting exists
  const companySetting = await CompanySetting.findById(id);
  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  // Validate request body
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, 'No update data provided');
  }

  // Update company setting
  const updatedCompanySetting = await CompanySetting.findByIdAndUpdate(
    id,
    { $set: req.body }, // Use $set to update only provided fields
    { new: true, runValidators: true }
  );

  if (!updatedCompanySetting) {
    throw new ApiError(500, 'Failed to update company setting');
  }

  // Return success response
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedCompanySetting,
        'Company setting updated successfully'
      )
    );
});
/**
 * @desc    Delete company setting
 * @route   DELETE /api/company-settings/:id
 * @access  Private/Admin
 */
export const deleteCompanySetting = asyncHandler(async (req, res) => {
  const companySetting = await CompanySetting.findById(req.params.id);

  if (!companySetting) {
    res.status(404);
    throw new Error('Company setting not found');
  }

  await companySetting.deleteOne();
  res.status(200).json({ message: 'Company setting removed' });
});

/**
 * @desc    Get default company setting
 * @route   GET /api/company-settings/default
 * @access  Private
 */
export const getDefaultCompanySetting = asyncHandler(async (req, res) => {
  // Assuming the first company setting is the default one
  // You might want to implement a different logic based on your requirements
  const companySetting = await CompanySetting.findOne().sort({ createdAt: 1 });

  if (companySetting) {
    res.status(200).json(companySetting);
  } else {
    res.status(404);
    throw new Error('No company settings found');
  }
});
