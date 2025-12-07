import z from "zod";

import { logErrorEmbed } from "../coms/logAction";
import { ENV } from "../env";

async function getTwitterFollowers(username: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${username}`,
      {
        headers: {
          "X-API-Key": ENV.X_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.log(response);
      throw new Error(
        `Failed to fetch twitter followers with response: ${response.status}`
      );
    }

    const data = await response.json();
    const followerCount = data.data.followers;
    const parsedFollowers = z.number().parse(followerCount);

    return parsedFollowers;
  } catch (err) {
    await logErrorEmbed(
      `**Unable to fetch twitter followers for @${username} - ${err}**`
    );
    return null;
  }
}

export default getTwitterFollowers;
