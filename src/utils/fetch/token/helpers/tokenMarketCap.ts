import z from "zod";

import { logErrorEmbed } from "../../../../utils/coms/logAction";
import { getWithRetry } from "../../treasury/helpers/fetchWithRetry";

const CoinGeckoResponseSchemaZ = z.object({
  market_data: z.object({
    market_cap: z.object({
      usd: z.number(),
    }),
  }),
});

type CoinGeckoResponseType = z.infer<typeof CoinGeckoResponseSchemaZ>;

export default async function fetchMarketCap(tokenSymbol: string): Promise<number | null> {
  try {
    const COIN_GECKO_ENDPOINT = `https://api.coingecko.com/api/v3/coins/${tokenSymbol}`;

    const response = await getWithRetry<CoinGeckoResponseType>(COIN_GECKO_ENDPOINT);
    const parsed = CoinGeckoResponseSchemaZ.parse(response);

    const marketCap = parsed.market_data.market_cap.usd;
    return marketCap;
  } catch (err) {
    await logErrorEmbed(`Error fetching market cap for ${tokenSymbol}: ${err}`);
    return null;
  }
}
