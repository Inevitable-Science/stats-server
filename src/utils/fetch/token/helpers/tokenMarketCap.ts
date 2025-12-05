import { logErrorEmbed } from "../../../../utils/coms/logAction";
import axios from "axios";
import z from "zod";

const CoinGeckoResponseSchemaZ = z.object({
  market_data: z.object({
    market_cap: z.object({
      usd: z.number()
    })
  })
});

export default async function fetchMarketCap(tokenSymbol: string): Promise<number | null> {
  try {
    const COIN_GECKO_ENDPOINT = `https://api.coingecko.com/api/v3/coins/${tokenSymbol}`;

    const response = await axios.get(COIN_GECKO_ENDPOINT, {
      timeout: 5000,
    });

    if (response.status !== 200) throw new Error(`Unexpected response status: ${response.status}`);
    const parsed = CoinGeckoResponseSchemaZ.parse(response.data);

    const marketCap = parsed.market_data.market_cap.usd;
    return marketCap;

  } catch (err) {
    await logErrorEmbed(`Error fetching market cap for ${tokenSymbol}: ${err}`);
    return null;
  }
}