import z from "zod";

import { ENV } from "../env";

export const EmbedZ = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  author: z
    .object({
      name: z.string(),
      icon_url: z.string().optional(),
    })
    .optional(),
  fields: z
    .array(
      z.object({
        name: z.string().max(256),
        value: z.string().max(1024),
        inline: z.boolean().optional(),
      })
    )
    .optional(),
});

export type Embed = z.infer<typeof EmbedZ>;

export async function logErrorEmbedTemp(error: string) {
  console.error("Server Error:", error);

  for (let chunk = 0; chunk < error.length; chunk += 2900) {
    const errorMessage = error.slice(0, 2900);
    const constructedEmbed = {
      title: "Error Logged",
      description: `\`\`\`${errorMessage}\`\`\`` || "Unknown Error",
    };

    await logAction({
      action: "logError",
      embed: constructedEmbed,
    });
  };

  return;
}

async function logAction({
  action,
  message,
  embed,
}: {
  action: "logError" | "logAction";
  message?: string;
  embed?: Embed;
}) {
  try {
    let color;
    if (action === "logError") {
      color = 12520460;
    } else {
      console.log(message);
      color = 2236962;
    }

    const webhook = process.env.DISCORD_WEBHOOK_URL_2;
    if (!webhook) throw new Error("NO DISCORD WEBHOOK");
    const payload: any = {};

    if (embed) {
      const footer = {
        text: "Analytics API",
        icon_url:
          "https://cdn.inevitable.science/static/img/branding/manifest/android-chrome-192x192.png",
      };

      const constructedEmbedd = { ...embed, color, footer };
      payload.embeds = [constructedEmbedd]; // Discord expects an array of embeds
    } else if (message) {
      payload.content = message;
    } else {
      return;
    }

    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error sending message to Discord:", error);
  } finally {
    return;
  }
}

export default logAction;
