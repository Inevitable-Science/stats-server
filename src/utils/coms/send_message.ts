import axios from "axios";

const sendDiscordMessage = async (message: string) => {
    try {
      const webhook = process.env.DISCORD_WEBHOOK_URL;

      if (!webhook) {
        console.warn("Discord webhook URL is required");
        return;
      }
    
      const discordMessage = {
        content: message
      };
      
      await axios.post(webhook, discordMessage);

    } catch (error) {
        console.error('Error sending message to Discord:', error);
    } finally {
        return;
    }
};

export default sendDiscordMessage;