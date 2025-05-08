import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

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

// import routers

import authRouter from './routes/auth.routes.js';
import leadRouter from './routes/lead.routes.js';
import folloupRouter from './routes/followup.routes.js';
import watsappRouter from './routes/whatsapp.route.js';
import companySettingRouter from './routes/companySetting.routes.js';
import callRouter from './routes/call.routes.js';

app.use('/api/v1/user', authRouter);
app.use('/api/v1/lead', leadRouter);
app.use('/api/v1/followup', folloupRouter);
app.use('/api/v1/watsapp', watsappRouter);
app.use('/api/v1/setting', companySettingRouter);
app.use('/api/v1/call', callRouter);

export { app };
