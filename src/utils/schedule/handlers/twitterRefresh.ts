// rfc
import FollowersModel from "../../../config/models/followersSchema";
import getTwitterFollowers from "../../fetch/twitterFollowers";
import { daos, trackFollowersArray } from "../../../config/constants";
import logAction, { logErrorEmbed } from "../../coms/logAction";
import { generateDiscordTimestamp } from "../../utils";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAndUpdateTwitterFollowers(): Promise<void> {
  try {
    await logAction({
      action: "logAction",
      message: `**Starting daily twitter followers refresh: ${generateDiscordTimestamp(new Date(), "R")}**`
    });

    const mappedTwitterUsername = daos
      .map(dao => dao.socials.x)
      .filter(username => typeof username === "string");
    const mappedTrackArray = trackFollowersArray.map(username => username.username);
    const combinedArrays: string[] = Array.from(new Set([...mappedTwitterUsername, ...mappedTrackArray]));

    for (const username of combinedArrays) {
      try {
        const followerCount = await getTwitterFollowers(username);
        if (!followerCount) throw new Error("API Error, Could Not Fetch");

        await FollowersModel.findOneAndUpdate(
          { username },
          {
            username,
            current_followers: followerCount,
            $push: {
              historical_followers: {
                date: new Date(),
                count: followerCount,
              },
            },
          },
          { upsert: true, new: true }
        );

        await logAction({
          action: "logAction",
          message: `**Refreshed twitter followers for @${username.toLowerCase()} - Count: ${followerCount} - ${generateDiscordTimestamp(new Date(), "R")}**`
        });
        await sleep(5000); // the api is heavily rate limited

      } catch (err) {
        console.error(err);
        await sleep(7000);
        continue;
      };
    };
    
    await logAction({
      action: "logAction",
      message: `**Daily twitter followers refresh complete: ${generateDiscordTimestamp(new Date(), "R")}**`
    });
    return;

  } catch (err) {
    console.error(err);
    await logErrorEmbed(`Error performing full twitter analytics refresh, Error: ${err}`);
    return;
  }
};

export default fetchAndUpdateTwitterFollowers;
