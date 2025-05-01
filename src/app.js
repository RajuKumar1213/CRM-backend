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
import leadRouter from "./routes/lead.routes.js"


app.use('/api/v1/user', authRouter);
app.use("/api/v1/lead", leadRouter)

export { app };
