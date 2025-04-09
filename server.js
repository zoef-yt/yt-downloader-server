const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { logCorsBlock } = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const allowedOrigins = [FRONTEND_ORIGIN];

app.use(express.json());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        logCorsBlock(null, 'Missing origin');
        return callback(new Error('No origin provided'));
      } else if (allowedOrigins.includes(origin)) {
        console.log('CORS allowed for origin:', origin);
        return callback(null, true);
      } else {
        logCorsBlock(origin, 'Not in allowlist');
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use((req, res, next) => {
  res.setTimeout(5 * 60 * 1000, () => {
    console.log(`Timeout: ${req.method} ${req.originalUrl}`);
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

app.use('/api', require('./routes/stream')); 
app.use('/api', require('./routes/download')); 

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
