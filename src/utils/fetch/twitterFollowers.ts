import z from "zod";

import { logErrorEmbed } from "../coms/logAction";
import { ENV } from "../env";

const FollowerResponseZ = z.object({
  data: z.object({
    followers: z.number()
  })
});

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
      throw new Error(`Failed to fetch twitter followers with response: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    const parsedData = FollowerResponseZ.parse(data);
    const followers =  parsedData.data.followers;

    return followers;
  } catch (err) {
    await logErrorEmbed(`**Unable to fetch twitter followers for @${username} - ${err}**`);
    return null;
  }
}

export default getTwitterFollowers;
