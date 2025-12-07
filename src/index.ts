import dotenv from "dotenv";
import type { NextFunction, Request, Response } from "express";
import express from "express";

dotenv.config();

// Dependencies
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import cron from "node-cron";
import { RateLimiterMemory } from "rate-limiter-flexible";

// Database

import TokenModel from "./config/models/tokenSchema";
import TreasuryModel from "./config/models/treasurySchema";
import daoRouter from "./routes/stats/dao/daoRouter";
import tokenRouter from "./routes/stats/token/tokenRouter";
import tokenListRouter from "./routes/web3/tokenlist/token_list";
import sendDiscordMessage from "./utils/coms/send_message";
import { ENV } from "./utils/env";
import { ErrorCodes } from "./utils/errors";
import dailyRefresh from "./utils/schedule/dailyRefresh";
import fetchAndUpdateTwitterFollowers from "./utils/schedule/handlers/twitterRefresh";



const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*", // allow any origin
    methods: ["GET", "POST"], // allow GET and POST requests
    credentials: false, // do not allow credentials (cookies, auth headers, etc.)
  })
);

// ----- IP RATE LIMIT: 10 req/sec -----
const ipLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// ----- GLOBAL RATE LIMIT: 15,000 req/min -----
const globalLimiter = new RateLimiterMemory({
  points: 15000,
  duration: 60,
});

const globalRateLimit = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await globalLimiter.consume("global");
    next();
  } catch {
    res.status(429).json({
      error: ErrorCodes.RATE_LIMIT,
    });
  }
};

// ----- Apply both middlewares -----
app.use(ipLimiter);
app.use(globalRateLimit);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(ENV.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

app.get("/", (_req, res) => {
  res.send("200");
});

cron.schedule("20 0 * * *", dailyRefresh); // Refresh treasury stats daily @ 00:20

app.use("/token", tokenRouter);
app.use("/dao", daoRouter);

app.use("/web3", tokenListRouter);

app.get("/schema", async (req: Request, res: Response) => {
  try {
    const data = await TreasuryModel.find();
    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Something went wrong.");
  }
});

// GET /schemaToken
app.get("/schemaToken", async (req: Request, res: Response) => {
  try {
    const data = await TokenModel.find();
    res.json(data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Something went wrong.");
  }
});

app.post("/refreshFollowers/:password", async (req: Request, res: Response) => {
  const { password } = req.params;

  if (!password || password != ENV.APP_PASSWORD) {
    res.status(400).json({ error: "Missing required parameter: password" });
    return;
  }

  try {
    await sendDiscordMessage(
      `**Request received to refresh followers stats at ${new Date().toLocaleString()}**`
    );
    res.status(202).json({ message: "Processing request in the background" });

    setImmediate(async () => {
      await fetchAndUpdateTwitterFollowers();
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Something went wrong.");
  }
});

app.post(
  "/refreshAll/:password",
  async (req: Request, res: Response): Promise<void> => {
    const { password } = req.params;

    if (!password || password != ENV.APP_PASSWORD) {
      res.status(400).json({ error: "Missing required parameter: password" });
      return;
    }

    try {
      await sendDiscordMessage(
        `**Request received to refresh all stats at ${new Date().toLocaleString()}**`
      );
      res.status(202).json({ message: "Processing request in the background" });

      // Set isRunning to true and process in the background
      setImmediate(async () => {
        try {
          await dailyRefresh();
        } catch (error) {
          console.error("Error initiating token refresh:", error);
          await sendDiscordMessage(
            `**Request to refresh all stats FAILED at ${new Date().toLocaleString()}**`
          );
          res.status(500).json({ error: "Internal server error" });
        }
      });
    } catch (error) {
      console.error("Error initiating token refresh:", error);
      await sendDiscordMessage(
        `**Request to refresh all stats FAILED at ${new Date().toLocaleString()}**`
      );
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("listening for requests");
  });
});
