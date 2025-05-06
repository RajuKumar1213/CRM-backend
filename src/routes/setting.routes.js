import express from 'express';
import {
  getCompanySettings,
  getCompanySettingById,
  createCompanySetting,
  updateCompanySetting,
  deleteCompanySetting,
  getDefaultCompanySetting
} from '../controllers/companySettings.controller.js';

import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Protect all routes with JWT middleware
router.use(verifyJWT);

/**
 * @route   GET /api/company-settings
 * @desc    Get all company settings
 */
router.get('/', getCompanySettings);

/**
 * @route   GET /api/company-settings/default
 * @desc    Get default (first created) company setting
 */
router.get('/default', getDefaultCompanySetting);

/**
 * @route   GET /api/company-settings/:id
 * @desc    Get single company setting by ID
 */
router.get('/:id', getCompanySettingById);

/**
 * @route   POST /api/company-settings
 * @desc    Create new company setting
 */
router.post('/', createCompanySetting);

/**
 * @route   PUT /api/company-settings/:id
 * @desc    Update existing company setting
 */
router.put('/:id', updateCompanySetting);

/**
 * @route   DELETE /api/company-settings/:id
 * @desc    Delete company setting
 */
router.delete('/:id', deleteCompanySetting);

export default router;
