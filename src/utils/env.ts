import { z } from "zod";

const EnvSchema = z.object({
  INFURA_KEY: z.string(),
  ALCHEMY_KEY: z.string(),
  ZAPPER_KEY: z.string(),
  APP_PASSWORD: z.string(),
  MONGO_URI: z.string(),
  DISCORD_WEBHOOK_URL: z.string(),
  X_API_KEY: z.string(),
});

export const ENV = EnvSchema.parse(process.env);

export type Env = z.infer<typeof EnvSchema>;
