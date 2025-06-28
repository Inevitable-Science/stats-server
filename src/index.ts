import express, { Request, Response } from 'express';
require('dotenv').config();

// Dependencies
import cors from 'cors';
import cron from 'node-cron';

import TreasuryModel from './config/models/treasury_schema';
import TokenModel from './config/models/token_schema';

import sendDiscordMessage from './utils/coms/send_message';

// Database
import mongoose from 'mongoose';

import dailyRefresh from './utils/schedule/daily_refresh';

import ohlcChartRouter from './routes/chart/ohlc_chart';
import marketChartRouter from './routes/chart/market_charts';
import databaseChartRouter from './routes/chart/database_charts';

import daoRouter from './routes/dao/daos'
import tokenRouter from './routes/dao/token'
import treasuryRouter from './routes/dao/treasury'

const app = express();
app.use(express.json())
const PORT = process.env.PORT || 3001;

/*const allowedOrigins = ['http://localhost:3000'];

app.use(cors({
  origin: (
    origin: string | undefined, 
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET',
  credentials: true,
  optionsSuccessStatus: 200,
}));*/

app.use(cors({
  origin: '*', // allow any origin
  methods: ['GET', 'POST'], // allow GET and POST requests
  credentials: false, // do not allow credentials (cookies, auth headers, etc.)
}));

const connectDB = async () => {
  try {

    const mongo_uri = process.env.MONGO_URI;
    if (!mongo_uri) {
      console.warn("No Mongo URI found");
      return;
    };

    const conn = await mongoose.connect(mongo_uri);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1); 
  }
};

app.get('/', (_req, res) => {
  res.send('200');
});

cron.schedule('20 0 * * *', dailyRefresh);  // Refresh treasury stats daily @ 00:20

app.use('/ohlc', ohlcChartRouter);
app.use('/chart', marketChartRouter);
app.use('/charts', databaseChartRouter);

app.use('/dao', daoRouter);
app.use('/token', tokenRouter);
app.use('/treasury', treasuryRouter);


app.get('/schema', async (req: Request, res: Response) => {
  try {
    const data = await TreasuryModel.find();
    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Something went wrong.");
  }
});

// GET /schemaToken
app.get('/schemaToken', async (req: Request, res: Response) => {
  try {
    const data = await TokenModel.find();
    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Something went wrong.");
  }
});

app.post('/refreshAll/:password', async (req: Request, res: Response): Promise<void> => {
  const { password } = req.params;

  if (!password || password != process.env.APP_PASSWORD) {
    res.status(400).json({ error: 'Missing required parameter: password' });
    return;
  }

  try {
    await sendDiscordMessage(`**Request to refresh all stats for at ${new Date().toLocaleString()}**`);
    res.status(202).json({ message: 'Processing request in the background' });

    // Set isRunning to true and process in the background
    setImmediate(async () => {
      try {
        await dailyRefresh();
      } catch (error) {
        console.error('Error initiating token refresh:', error);
        await sendDiscordMessage(`**Request to refresh all stats FAILED at ${new Date().toLocaleString()}**`);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  } catch (error) {
    console.error('Error initiating token refresh:', error);
    await sendDiscordMessage(`**Request to refresh all stats FAILED at ${new Date().toLocaleString()}**`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("listening for requests");
  });
});