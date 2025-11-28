import sendDiscordMessage from "../../../utils/coms/send_message";
import { daos, trackFollowersArray } from "../../../config/constants";
import getTwitterFollowers from "../../../utils/fetch/twitter_followers";
import FollowersModel, {
  FollowersDocument,
} from "../../../config/models/followers_schema";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAndUpdateTwitterFollowers(): Promise<void> {
  try {
    await sendDiscordMessage(
      `**Starting daily twitter followers refresh at: ${new Date().toLocaleString()}**`
    );

    for (const foundDao of daos) {
      const twitter_username = foundDao.socials.x;
      if (!twitter_username) continue;

      const follower_count = await getTwitterFollowers(twitter_username);
      if (!follower_count || isNaN(follower_count) === true) continue;

      await FollowersModel.findOneAndUpdate(
        { username: twitter_username },
        {
          username: twitter_username,
          current_followers: follower_count,
          $push: {
            historical_followers: {
              date: new Date(),
              count: follower_count,
            },
          },
        },
        { upsert: true, new: true }
      );

      await sendDiscordMessage(
        `**Refreshed twitter followers for @${twitter_username} - Count: ${follower_count} at: ${new Date().toLocaleString()}**`
      );
      await sleep(5000);
    }

    for (const account of trackFollowersArray) {
      const twitter_username = account.username;
      if (!twitter_username) continue;

      const follower_count = await getTwitterFollowers(twitter_username);
      if (!follower_count || isNaN(follower_count) === true) continue;

      await FollowersModel.findOneAndUpdate(
        { username: twitter_username },
        {
          username: twitter_username,
          current_followers: follower_count,
          $push: {
            historical_followers: {
              date: new Date(),
              count: follower_count,
            },
          },
        },
        { upsert: true, new: true }
      );

      await sendDiscordMessage(
        `**Refreshed twitter followers for @${twitter_username} - Count: ${follower_count} at: ${new Date().toLocaleString()}**`
      );
      await sleep(5000);
    }
  } catch (err) {
    console.log(err);
    await sendDiscordMessage(
      `**Failed to refresh twitter followers at: ${new Date().toLocaleString()}**`
    );
  }
}

export default fetchAndUpdateTwitterFollowers;
