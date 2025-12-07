import axios from "axios";

import { ENV } from "../env";

const sendDiscordMessage = async (message: string) => {
  try {
    const discordMessage = {
      content: message,
    };

    await axios.post(ENV.DISCORD_WEBHOOK_URL, discordMessage);
  } catch (error) {
    console.error("Error sending message to Discord:", error);
  } finally {
    return;
  }
};

export default sendDiscordMessage;
