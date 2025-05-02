import { Router } from 'express';
import {
  completeFollowUp,
  createFollowUp,
  deleteFollowUp,
  getFollowUp,
  getFollowUps,
  updateFollowUp,
  getTodayFollowUps,
  getOverdueFollowUps,
  getUpcomingFollowUps,
} from '../controllers/followUp.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.route('/get-all').get(verifyJWT, getFollowUps);
router.route('/:leadId/fetch').get(verifyJWT, getFollowUp);
router.route('/:leadId/create').post(verifyJWT, createFollowUp);
router.route('/:followUpId/update').patch(verifyJWT, updateFollowUp);
router.route('/:followUpId/delete').delete(verifyJWT, deleteFollowUp);
router.route('/:followUpId/complete').patch(verifyJWT, completeFollowUp);

router.route('/fetch-today-followups').get(verifyJWT, getTodayFollowUps);

router.route('/fetch-overdue-followups').get(verifyJWT, getOverdueFollowUps);
router.route('/fetch-upcomming-followups').get(verifyJWT, getUpcomingFollowUps);

export default router;
