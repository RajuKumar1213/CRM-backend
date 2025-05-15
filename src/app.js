import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { initializeSocket } from './utils/socket.js';

const app = express();
const httpServer = createServer(app);

dotenv.config();

// cors
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(express.static('public'));
app.use(cookieParser());

// Initialize Socket.IO
initializeSocket(httpServer);

// import routers

import authRouter from './routes/auth.routes.js';
import leadRouter from './routes/lead.routes.js';
import followUpRouter from './routes/followUp.routes.js';
import watsappRouter from './routes/whatsapp.route.js';
import companySettingRouter from './routes/setting.routes.js';
import callRouter from './routes/call.routes.js';
import chatbotRouter from './routes/chatbot.routes.js';

app.use('/api/v1/user', authRouter);
app.use('/api/v1/lead', leadRouter);
app.use('/api/v1/followup', followUpRouter);
app.use('/api/v1/watsapp', watsappRouter);
app.use('/api/v1/setting', companySettingRouter);
app.use('/api/v1/call', callRouter);
app.use("/api/v1/chatbot", chatbotRouter);

export { httpServer, app };
