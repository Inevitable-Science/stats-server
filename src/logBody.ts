import { Request, Response } from "express";
import z from "zod";
import { ENV } from "./utils/env";
import { daos, trackFollowersArray } from "./config/constants";
import logAction from "./utils/coms/logAction";

/*
const AuthorSchema = z.union([
  z.object({
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
  automatedBy: z.null(),* /
}),
z.object({})
]);

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
  twitterUrl: z.string(),
  text: z.string(),
  viewCount: z.number(),
  createdAt: z.string(),
  lang: z.string(),
  bookmarkCount: z.number(),
  isReply: z.boolean(),
  inReplyToId: z.string().nullable(),
  displayTextRange: z.array(z.number()).length(2).nullable(),
  isRetweet: z.boolean().optional(),
  author: AuthorSchema,
  extendedEntities: z.object({
    media: z.array(MediaItemSchema).optional()
  }),
  isQuote: z.boolean().optional(),
  get quoted_tweet() {
    return TweetSchema.optional().nullable(); // or Example if required
  },
});*/

const AuthorSchema = z.union([
  z.object({
    type: z.literal('user'),
    userName: z.string(),
    url: z.string(),
    name: z.string(),
    profilePicture: z.string(),
  }),
  z.object({})
]);

const TweetSchema = z.object({
  type: z.literal('tweet'),
  id: z.string(),
  url: z.string(),
  twitterUrl: z.string(),
  text: z.string(),
  viewCount: z.number(),
  isReply: z.boolean(),
  author: AuthorSchema,
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


export async function logXResponse(req: Request, res: Response) {
  try {
    const body = req.body;
    const headers = req.headers;

    if (headers["x-api-key"] !== ENV.X_API_KEY) return;
    const parsedBody = logZod.parse(body);
    
    if (parsedBody.rule_id !== "0fc10b102b7c437a867619680108980d") return;
    const tweets = parsedBody.tweets;

    for (const tweet of tweets) {
      const tweetAuthor = tweet.author.userName;
      const userExsists = 
        daos.some(d => d.socials.x?.toLowerCase() === tweetAuthor.toLocaleLowerCase()) || 
        trackFollowersArray.some(u => u.toLowerCase() === tweetAuthor.toLowerCase());

      if (!userExsists) {
        continue;
      };

      const message = `New ${tweet.isReply ? "Reply" : "Post"} from ${tweet.author.name} [@${tweetAuthor}](${tweet.twitterUrl})[⤵](${tweet.url.replace("https://x.com", "https://fixupx.com")})`
      await logAction({ action: "logAction", message });
    };

  } catch (err) {
    console.error(err);
  } finally {
    res.status(200).json({ success: true });
  }
}