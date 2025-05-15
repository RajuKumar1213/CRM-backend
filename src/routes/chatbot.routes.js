import { Router } from 'express';

import { verifyJWT } from '../middleware/auth.middleware.js';
import { handleChatRequest } from '../controllers/chatbot.controller.js';

const router = Router();


router.route("/chat").post(verifyJWT, handleChatRequest);

export default router;
