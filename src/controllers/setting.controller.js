import asyncHandler from 'express-async-handler';
import { CompanySetting } from '../models/CompanySettings.models';

/**
 * @desc    Get all company settings
 * @route   GET /api/company-settings
 * @access  Private/Admin
 */
export const getCompanySettings = asyncHandler(async (req, res) => {
  const companySettings = await CompanySetting.find({});
  res.status(200).json(companySettings);
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
    whatsappApiKey,
    whatsappApiProvider,
    whatsappApiUrl,
    leadRotationEnabled,
    numberRotationEnabled,
    autoFollowupEnabled,
    defaultFollowupIntervals,
  } = req.body;

  const companySettingExists = await CompanySetting.findOne({ companyName });

  if (companySettingExists) {
    res.status(400);
    throw new Error('Company setting with this name already exists');
  }

  const companySetting = await CompanySetting.create({
    companyName,
    logo,
    contactNumbers,
    whatsappApiKey,
    whatsappApiProvider,
    whatsappApiUrl,
    leadRotationEnabled,
    numberRotationEnabled,
    autoFollowupEnabled,
    defaultFollowupIntervals,
  });

  if (companySetting) {
    res.status(201).json(companySetting);
  } else {
    res.status(400);
    throw new Error('Invalid company setting data');
  }
});

/**
 * @desc    Update company setting
 * @route   PUT /api/company-settings/:id
 * @access  Private/Admin
 */
export const updateCompanySetting = asyncHandler(async (req, res) => {
  const companySetting = await CompanySetting.findById(req.params.id);

  if (!companySetting) {
    res.status(404);
    throw new Error('Company setting not found');
  }

  const updatedCompanySetting = await CompanySetting.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json(updatedCompanySetting);
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
