import { Address } from "viem";

import fetchMarketCap from "./helpers/tokenMarketCap";
import calculateTokenDistribution, {
  PercentileStat,
} from "./helpers/calculateTokenDistribution";
import fetchTokenHolders, { TopHolder } from "./helpers/fetchTokenHolders";
import { logErrorEmbed } from "../../coms/logAction";

// Interface for holder data
export interface Holder {
  address: string;
  balance: number;
}

export interface TokenStatsResponse {
  totalSupply: number;
  marketCap: number | null;
  topHoldersProportion: number;
  topHolders: TopHolder[];
  totalHolders: number;
  averageBalance: number;
  medianBalance: number;
  groupStats: PercentileStat[];
}

async function getTokenStats(
  tokenSymbol: string,
  tokenAddress: Address,
  startBlock: number
): Promise<TokenStatsResponse | null> {
  try {
    const [holdersStats, marketCap] = await Promise.all([
      await fetchTokenHolders(tokenAddress, startBlock),
      await fetchMarketCap(tokenSymbol),
    ]);

    if (!holdersStats)
      throw new Error(
        "Failed to fetch holders stats, fetchHolders returned null"
      );

    const calculatedStats = calculateTokenDistribution(
      holdersStats.allHolders,
      holdersStats.totalSupply
    );
    if (!calculatedStats)
      throw new Error(
        "Failed to calculate holders stats, calculateStats returned null"
      );

    return { ...holdersStats, ...calculatedStats, marketCap };
  } catch (err) {
    logErrorEmbed(`Error in top level getTokenStats function: ${err}`);
    return null;
  }
}

export default getTokenStats;
