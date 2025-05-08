import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  addPhoneNumber,
  createWhatsappTemplate,
  deletePhoneNumber,
  deleteWhatsappTemplate,
  getMessageHistory,
  getPhoneNumbers,
  getWhatsappStats,
  getWhatsappTemplate,
  getWhatsappTemplates,
  sendWhatsappMessage,
  updatePhoneNumber,
  updateWhatsappTemplate,
} from '../controllers/watsapp.controller.js';

const router = Router();

// Template routes
router.route('/templates').post(verifyJWT, createWhatsappTemplate); // CREATE
router.route('/templates').get(verifyJWT, getWhatsappTemplates); // READ all
router.route('/templates/:templateId').get(verifyJWT, getWhatsappTemplate); // READ one
router.route('/templates/:id').patch(verifyJWT, updateWhatsappTemplate); // UPDATE
router.route('/templates/:id').delete(verifyJWT, deleteWhatsappTemplate); // DELETE

// Send message
router.route('/messages/:leadId').post(verifyJWT, sendWhatsappMessage);
router.route('/messages/history/:leadId').get(verifyJWT, getMessageHistory);

// Phone number management
router.route('/numbers').post(verifyJWT, addPhoneNumber); // ADD
router.route('/numbers').get(verifyJWT, getPhoneNumbers); // GET ALL
router.route('/numbers/:id').patch(verifyJWT, updatePhoneNumber); // UPDATE
router.route('/numbers/:id').delete(verifyJWT, deletePhoneNumber); // DELETE

// Stats
router.route('/stats').get(verifyJWT, getWhatsappStats);

export default router;
