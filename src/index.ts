import express from "express";
import type { NextFunction, Request, Response } from "express";

// Dependencies
import cors from "cors";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import cron from "node-cron";
import { RateLimiterMemory } from "rate-limiter-flexible";

import daoRouter from "./routes/stats/dao/daoRouter";
import tokenRouter from "./routes/stats/token/tokenRouter";
import tokenListRouter from "./routes/web3/tokenlist/token_list";

import dailyRefresh from "./utils/schedule/dailyRefresh";
import fetchAndUpdateTwitterFollowers from "./utils/schedule/handlers/twitterRefresh";
import logAction, { logErrorEmbed } from "./utils/coms/logAction";
import { generateDiscordTimestamp } from "./utils/utils";
import { ENV } from "./utils/env";
import { ErrorCodes } from "./utils/errors";
import logAction2, { logErrorEmbedTemp } from "./utils/coms/tempLog";
import z from "zod";
import { daos, trackFollowersArray } from "./config/constants";


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

const globalRateLimit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

cron.schedule("20 0 * * *", dailyRefresh); // Refresh treasury stats daily @ 00:20

app.use("/token", tokenRouter);
app.use("/dao", daoRouter);
app.use("/web3", tokenListRouter);

app.post("/refreshFollowers/:password", async (req: Request, res: Response) => {
  const { password } = req.params;

  if (!password || password != ENV.APP_PASSWORD) {
    res.status(400).json({ error: "Missing required parameter: password" });
    return;
  }

  try {
    await logAction({
      action: "logAction",
      message: `**Request received to refresh followers stats at ${generateDiscordTimestamp(new Date(), "R")}**`
    });
    res.status(202).json({ message: "Processing request in the background" });

    setImmediate(async () => {
      await fetchAndUpdateTwitterFollowers();
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Something went wrong.");
  }
});

app.post("/refreshAll/:password", async (req: Request, res: Response): Promise<void> => {
  const { password } = req.params;

  if (!password || password != ENV.APP_PASSWORD) {
    res.status(400).json({ error: "Missing required parameter: password" });
    return;
  }

  try {
    await logAction({
      action: "logAction",
      message: `**Request received to refresh all stats at ${generateDiscordTimestamp(new Date(), "R")}**`
    });
    res.status(202).json({ message: "Processing request in the background" });

    // Set isRunning to true and process in the background
    setImmediate(async () => {
      try {
        await dailyRefresh();
      } catch (error) {
        console.error("Error initiating token refresh:", error);
        await logAction({
          action: "logAction",
          message: `**Request to refresh all stats FAILED at ${generateDiscordTimestamp(new Date(), "R")}**`
        });
        res.status(500).json({ error: "Internal server error" });
      }
    });
  } catch (error) {
    console.error("Error initiating token refresh:", error);
    await logAction({
      action: "logAction",
      message: `**Request to refresh all stats FAILED at ${generateDiscordTimestamp(new Date(), "R")}**`
    });
    res.status(500).json({ error: "Internal server error" });
  }
});













/*const UserMentionSchema = z.object({
  id_str: z.string(),
  indices: z.array(z.number()).length(2),
  name: z.string(),
  screen_name: z.string(),
});

const EntitiesSchema = z.object({
  user_mentions: z.array(UserMentionSchema),
});

const SymbolSchema = z.object({
  indices: z.array(z.number()).length(2),
  text: z.string(),
});

const ProfileBioEntitiesDescriptionSchema = z.object({
  symbols: z.array(SymbolSchema),
});

const ProfileBioEntitiesSchema = z.object({
  description: ProfileBioEntitiesDescriptionSchema,
});

const ProfileBioSchema = z.object({
  description: z.string(),
  entities: ProfileBioEntitiesSchema,
});

const UserEntitiesDescriptionSchema = z.object({
  urls: z.array(z.unknown()).length(0),
});

const UserEntitiesSchema = z.object({
  description: UserEntitiesDescriptionSchema,
  url: z.object({}),
});

const AuthorSchema = z.object({
  type: z.literal('user'),
  userName: z.string(),
  url: z.string(),
  twitterUrl: z.string(),
  id: z.string(),
  name: z.string(),
  isVerified: z.boolean(),
  isBlueVerified: z.boolean(),
  verifiedType: z.null(),
  profilePicture: z.string(),
  coverPicture: z.string(),
  description: z.string(),
  location: z.string(),
  followers: z.number(),
  following: z.number(),
  status: z.string(),
  canDm: z.boolean(),
  canMediaTag: z.boolean(),
  createdAt: z.string(),
  entities: UserEntitiesSchema,
  fastFollowersCount: z.number(),
  favouritesCount: z.number(),
  hasCustomTimelines: z.boolean(),
  isTranslator: z.boolean(),
  mediaCount: z.number(),
  statusesCount: z.number(),
  withheldInCountries: z.array(z.unknown()).length(0),
  affiliatesHighlightedLabel: z.object({}),
  possiblySensitive: z.boolean(),
  pinnedTweetIds: z.array(z.unknown()).length(0),
  profile_bio: ProfileBioSchema,
  isAutomated: z.boolean(),
  automatedBy: z.null(),
});

const MediaItemSchema = z.object({
  display_url: z.string(),
  expanded_url: z.string(),
  id_str: z.string(),
  indices: z.array(z.number()),
  media_key: z.string(),
  media_url_https: z.string(),
  type: z.string(),
  url: z.string(),
});

const TweetSchema = z.object({
  type: z.literal('tweet'),
  id: z.string(),
  url: z.string(),
  twitterUrl: z.string(),
  text: z.string(),
  source: z.string(),
  retweetCount: z.number(),
  replyCount: z.number(),
  likeCount: z.number(),
  quoteCount: z.number(),
  viewCount: z.number(),
  createdAt: z.string(),
  lang: z.string(),
  bookmarkCount: z.number(),
  isReply: z.boolean(),
  inReplyToId: z.string(),
  conversationId: z.string(),
  displayTextRange: z.array(z.number()).length(2),
  inReplyToUserId: z.string(),
  inReplyToUsername: z.string(),
  author: AuthorSchema,
  extendedEntities: z.object({
    media: z.array(MediaItemSchema)
  }),
  card: z.null(),
  place: z.object({}),
  entities: EntitiesSchema,
  quoted_tweet: z.null(),
  retweeted_tweet: z.null(),
  isLimitedReply: z.boolean(),
  article: z.null(),
});*/

// -----------------------------------------------------------------------------
/*const UserMentionSchema = z.object({
  id_str: z.string(),
  indices: z.array(z.number()).length(2),
  name: z.string(),
  screen_name: z.string(),
});

const EntitiesSchema = z.object({
  user_mentions: z.array(UserMentionSchema),
});

const SymbolSchema = z.object({
  indices: z.array(z.number()).length(2),
  text: z.string(),
});

const ProfileBioEntitiesDescriptionSchema = z.object({
  symbols: z.array(SymbolSchema),
});

const ProfileBioEntitiesSchema = z.object({
  description: ProfileBioEntitiesDescriptionSchema,
});

const ProfileBioSchema = z.object({
  description: z.string(),
  entities: ProfileBioEntitiesSchema,
});

const UserEntitiesDescriptionSchema = z.object({
  urls: z.array(z.unknown()).length(0),
});

const UserEntitiesSchema = z.object({
  description: UserEntitiesDescriptionSchema,
  url: z.object({}),
});*/

const AuthorSchema = z.object({
  type: z.literal('user'),
  userName: z.string(),
  url: z.string(),
  //twitterUrl: z.string(),
  //id: z.string(),
  name: z.string(),
  //isVerified: z.boolean(),
  //isBlueVerified: z.boolean(),
  //verifiedType: z.null(),
  profilePicture: z.string(),
  /*coverPicture: z.string(),
  description: z.string(),
  location: z.string(),
  followers: z.number(),
  following: z.number(),
  status: z.string(),
  canDm: z.boolean(),
  canMediaTag: z.boolean(),
  createdAt: z.string(),
  entities: UserEntitiesSchema,
  fastFollowersCount: z.number(),
  favouritesCount: z.number(),
  hasCustomTimelines: z.boolean(),
  isTranslator: z.boolean(),
  mediaCount: z.number(),
  statusesCount: z.number(),
  withheldInCountries: z.array(z.unknown()).length(0),
  affiliatesHighlightedLabel: z.object({}),
  possiblySensitive: z.boolean(),
  pinnedTweetIds: z.array(z.unknown()).length(0),
  profile_bio: ProfileBioSchema,
  isAutomated: z.boolean(),
  automatedBy: z.null(),*/
});

const MediaItemSchema = z.object({
  display_url: z.string(),
  expanded_url: z.string(),
  media_key: z.string(),
  media_url_https: z.string(),
  type: z.string(),
  url: z.string(),
});

const TweetSchema = z.object({
  type: z.literal('tweet'),
  id: z.string(),
  url: z.string(),
  text: z.string(),
  viewCount: z.number(),
  createdAt: z.string(),
  lang: z.string(),
  bookmarkCount: z.number(),
  isReply: z.boolean(),
  //inReplyToId: z.string(),
  //conversationId: z.string(),
  //displayTextRange: z.array(z.number()).length(2),
  //inReplyToUserId: z.string(),
  //inReplyToUsername: z.string(),
  author: AuthorSchema,
  extendedEntities: z.object({
    media: z.array(MediaItemSchema)
  }),
  /*card: z.null(),
  place: z.object({}),
  entities: EntitiesSchema,
  quoted_tweet: z.null(),
  retweeted_tweet: z.null(),
  isLimitedReply: z.boolean(),
  article: z.null(),*/
});

// TEMP

const logZod = z.object({
  tweets: z.array(TweetSchema),
  rule_id: z.string(),
  rule_tag: z.string(),
  rule_value: z.string(),
  event_type: z.string(),
  timestamp: z.number(),
});



app.post("/logBody", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    const headers = req.headers;

    if (headers["x-api-key"] !== ENV.X_API_KEY) return;
    const parsedBody = logZod.parse(body);

    const tweets = parsedBody.tweets;

    for (const tweet of tweets) {
      const tweetAuthor = tweet.author.userName;
      const userExsists = 
        daos.some(d => d.socials.x?.toLowerCase() === tweetAuthor.toLocaleLowerCase()) || 
        trackFollowersArray.some(u => u.username.toLowerCase() === tweetAuthor.toLowerCase());

      if (!userExsists) {
        await logErrorEmbedTemp(`User not within array found: ${tweetAuthor} - ${tweet.url}`);
        //continue;
      };

      const mediaUrls = tweet.extendedEntities.media.map(m => m.media_url_https);

      const constructedEmbed = {
        author: {
          name: `${tweet.author.name} (@${tweetAuthor}) Just Tweeted`,
          icon_url: tweet.author.profilePicture,
          url: tweet.url
        },
        title: "Error Logged",
        description: tweet.text,
        ...(mediaUrls[0] && {
          image: {
            url: mediaUrls[0],
          },
        })
      };
      
      await logAction2({ action: "logAction", embed: constructedEmbed });
    };

    // await logErrorEmbedTemp(`\`\`\`${JSON.stringify(headers, null, 2)}\`\`\``);
    // await logErrorEmbedTemp(`${headers["X-API-Key"]} \n ${JSON.stringify(body, null, 2)}`);
  } catch (err) {
    console.error(err);
  } finally {
    res.status(200).json({ success: true });
  }
})

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("listening for requests");
  });
});
