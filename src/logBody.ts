import { Request, Response } from "express";
import z from "zod";
import logAction2, { logErrorEmbedTemp } from "./utils/coms/tempLog";
import { ENV } from "./utils/env";
import { daos, trackFollowersArray } from "./config/constants";


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
  inReplyToId: z.string().nullable(),
  //conversationId: z.string(),
  displayTextRange: z.array(z.number()).length(2).nullable(),
  //inReplyToUserId: z.string(),
  //inReplyToUsername: z.string(),
  isRetweet: z.boolean().optional(),
  author: AuthorSchema,
  extendedEntities: z.object({
    media: z.array(MediaItemSchema).optional()
  }),
  isQuote: z.boolean().optional(),
  /*quoted_tweet: z.object({
    get quoted_tweet() {
      return TweetSchema.optional(); // or Example if required
    },
    // ... other nested properties here
  }).optional().nullable(),*/
  get quoted_tweet() {
    return TweetSchema.optional().nullable(); // or Example if required
  },
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


export async function logXResponse(req: Request, res: Response) {
  try {
    const body = req.body;
    const headers = req.headers;

    if (headers["x-api-key"] !== ENV.X_API_KEY) return;
    console.log(body.tweets);
    const parsedBody = logZod.parse(body);

    const tweets = parsedBody.tweets;

    for (const tweet of tweets) {
      const tweetAuthor = tweet.author.userName;
      const userExsists = 
        daos.some(d => d.socials.x?.toLowerCase() === tweetAuthor.toLocaleLowerCase()) || 
        trackFollowersArray.some(u => u.toLowerCase() === tweetAuthor.toLowerCase());

      if (!userExsists) {
        await logErrorEmbedTemp(`User not within array found: ${tweetAuthor} - ${tweet.url}`);
        //continue;
      };
      

      const mediaUrls = tweet.extendedEntities.media?.map(m => m.media_url_https);

      const quotedTweet = tweet.quoted_tweet;
      const quoteTweetText = `
      > [Quoting](${quotedTweet?.url}) ${quotedTweet?.author.name} ([@${quotedTweet?.author.userName}](${quotedTweet?.author.url}))\n\n${
        tweet.quoted_tweet?.text.slice(
          quotedTweet?.displayTextRange?.[0] ?? 0,
          quotedTweet?.displayTextRange?.[1] ?? 400
        ) ?? ""}
      `;

      const tweetText = tweet.displayTextRange ? tweet.text.slice(tweet.displayTextRange[0], tweet.displayTextRange[0]) : tweet.text;
      const description = `${tweetText} ${
        tweet.isQuote ? `\n\n${quoteTweetText}` : ""
      }`

      const constructedEmbed = {
        author: {
          name: `${tweet.author.name} (@${tweetAuthor}) Just Posted`,
          icon_url: tweet.author.profilePicture,
          url: tweet.url
        },
        title: "",
        description,
        ...((mediaUrls && mediaUrls.length > 0)&& {
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
}