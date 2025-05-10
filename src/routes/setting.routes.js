import express from 'express';
import {
  getCompanySettings,
  getCompanySettingById,
  createCompanySetting,
  updateCompanySetting,
  deleteCompanySetting,
  getDefaultCompanySetting,
  getAdminDashboardStats,
  getUserPerformance,
  getCompanyHealth
} from '../controllers/setting.controller.js';

import { verifyJWT } from '../middleware/auth.middleware.js';

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

/**
 * @route   GET /api/company-settings/admin/dashboard-stats
 * @desc    Get admin dashboard statistics
 * @access  Private/Admin
 */
router.get('/admin/dashboard-stats', getAdminDashboardStats);

/**
 * @route   GET /api/company-settings/admin/user-performance
 * @desc    Get user performance statistics
 * @access  Private/Admin
 */
router.get('/admin/user-performance', getUserPerformance);

/**
 * @route   GET /api/company-settings/admin/company-health
 * @desc    Get company health metrics
 * @access  Private/Admin
 */
router.get('/admin/company-health', getCompanyHealth);

export default router;
