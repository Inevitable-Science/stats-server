import sendDiscordMessage from "../coms/send_message";

async function getTwitterFollowers(username: string): Promise<number | null> {
  try {
    const X_API_KEY = process.env.X_API_KEY;
    if (!X_API_KEY) throw new Error("No X API Key found");

    const response = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${username}`,
      {
        headers: {
          "X-API-Key": X_API_KEY,
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
