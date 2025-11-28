import sendDiscordMessage from "../coms/send_message";
import { ENV } from "../env";

async function getTwitterFollowers(username: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${username}`, {
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
    console.log(data);
    const followerCount = data.data.followers;
    if (!followerCount)
      throw new Error(
        `Followers not found in array for ${username} - status: ${response.status}`
      );

    return followerCount;
  } catch (err) {
    console.log(err);
    await sendDiscordMessage(`Unable to fetch twitter stats for @${username}`);
    return null;
  }
}

export default getTwitterFollowers;
