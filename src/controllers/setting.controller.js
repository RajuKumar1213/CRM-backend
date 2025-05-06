import mongoose from 'mongoose';
import { CompanySetting } from '../models/CompanySettings.models.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Get all company settings
 * @route GET /api/company-settings
 * @access Private/Admin
 */
export const getCompanySettings = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view company settings');
  }

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
 * Get single company setting by ID
 * @route GET /api/company-settings/:id
 * @access Private/Admin
 */
export const getCompanySettingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view company setting');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  const companySetting = await CompanySetting.findById(id);

  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companySetting,
        'Company setting retrieved successfully'
      )
    );
});

/**
 * Create new company setting
 * @route POST /api/company-settings
 * @access Private/Admin
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

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to create company setting');
  }

  if (!companyName) {
    throw new ApiError(400, 'Company name is required');
  }

  const companySettingExists = await CompanySetting.findOne({ companyName });
  if (companySettingExists) {
    throw new ApiError(400, 'Company setting with this name already exists');
  }

  const companySetting = await CompanySetting.create({
    companyName,
    logo,
    contactNumbers: contactNumbers || [],
    whatsappApiProvider: whatsappApiProvider || 'twilio',
    whatsappApiUrl,
    leadRotationEnabled: leadRotationEnabled ?? false,
    numberRotationEnabled: numberRotationEnabled ?? false,
    autoFollowupEnabled: autoFollowupEnabled ?? false,
    defaultFollowupIntervals: defaultFollowupIntervals || [],
  });

  if (!companySetting) {
    throw new ApiError(
      400,
      'Failed to create company setting due to invalid data'
    );
  }

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
 * Update company setting
 * @route PUT /api/company-settings/:id
 * @access Private/Admin
 */
export const updateCompanySetting = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to update company setting');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  const companySetting = await CompanySetting.findById(id);
  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, 'No update data provided');
  }

  const updatedCompanySetting = await CompanySetting.findByIdAndUpdate(
    id,
    { $set: req.body },
    { new: true, runValidators: true }
  );

  if (!updatedCompanySetting) {
    throw new ApiError(500, 'Failed to update company setting');
  }

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
 * Delete company setting
 * @route DELETE /api/company-settings/:id
 * @access Private/Admin
 */
export const deleteCompanySetting = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to delete company setting');
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid company setting ID');
  }

  const companySetting = await CompanySetting.findById(id);
  if (!companySetting) {
    throw new ApiError(404, 'Company setting not found');
  }

  await CompanySetting.findByIdAndDelete(id);

  res
    .status(200)
    .json(new ApiResponse(200, {}, 'Company setting deleted successfully'));
});

/**
 * Get default company setting
 * @route GET /api/company-settings/default
 * @access Private/Admin
 */
export const getDefaultCompanySetting = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(401, 'Not authorized to view default company setting');
  }

  const companySetting = await CompanySetting.findOne().sort({ createdAt: 1 });

  if (!companySetting) {
    throw new ApiError(404, 'No company settings found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        companySetting,
        'Default company setting retrieved successfully'
      )
    );
});
