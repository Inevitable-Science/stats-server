import type { Address } from "viem";

import type { TokenDistribution, TopHolder } from "../../../config/models/tokenSchema";
import { logErrorEmbed } from "../../coms/logAction";

import calculateTokenDistribution from "./helpers/calculateTokenDistribution";
import fetchTokenHolders from "./helpers/fetchTokenHolders";
import fetchMarketCap from "./helpers/tokenMarketCap";


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
  groupStats: TokenDistribution[];
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
