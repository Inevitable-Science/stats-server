import axios, { AxiosResponse } from "axios";
import { ethers } from "ethers";
import { ENV } from "../../env";
import { Address, createPublicClient, erc20Abi, formatUnits, http, parseAbiItem } from "viem";
import { mainnet } from 'viem/chains';
import TokenHoldersModel, { TokenHoldersDocument } from "../../../config/models/tokenHoldersSchema";
import z from "zod";
import { logErrorEmbed } from "../../coms/logAction";

// Interface for holder data
interface Holder {
  address: string;
  balance: number;
}

const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

const CoinGeckoResponseSchemaZ = z.object({
  market_data: z.object({
    market_cap: z.object({
      usd: z.number()
    })
  })
});

async function fetchMarketCap(tokenSymbol: string): Promise<number | null> {
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
    console.error(
      `Error fetching market cap for ${tokenSymbol}: ${err}`
    );
    await logErrorEmbed(`Error fetching market cap for ${tokenSymbol}: ${err}`);
    return null;
  }
}


const TransferArgsSchema = z.tuple([
  z.string(), // from
  z.string(), // to
  z.bigint(), // value
]);

interface TransferEventArgs {
  from: string;
  to: string;
  value: ethers.BigNumberish;
}

interface TopHolder {
  address: string;
  token_amount: number;
  account_type: "wallet" | "contract" | "unknown";
}

interface FetchHoldersResponse {
  totalSupply: number;
  allHolders: Holder[];
  topHoldersProportion: number;
  topHolders: TopHolder[];
}


async function fetchHolders(
  tokenAddress: Address,
  initialBlock: number,
): Promise<FetchHoldersResponse | null> {
  
  const batchSize = 100_000; // Process events in batches of 100,000 blocks
  const minBalanceThreshold = 0.01; // Only include accounts with >0.01 tokens

  try {
    const provider = new ethers.JsonRpcProvider(
      `https://mainnet.infura.io/v3/${ENV.INFURA_KEY}`
    );
    if (!provider) throw new Error(`Couldn't initialize provider contract in fetchHolders`);

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    if (!tokenContract) throw new Error(`Couldn't initialize token contract in fetchHolders`);
    
    // Get total supply and format it
    const [totalSupply, decimals, tokenHoldersEntry]: [bigint, bigint, TokenHoldersDocument | null] = await Promise.all([
      await tokenContract.totalSupply(),
      await tokenContract.decimals(),
      await TokenHoldersModel.findByTokenAddress(tokenAddress),
    ]);

    const parsedTotalSupply = Math.round(
      parseFloat(formatUnits(totalSupply, Number(decimals)))
    );

    const currentBlock = await provider.getBlockNumber();
    
    const holders: Map<string, number> = new Map();
    let startBlock = initialBlock;

    if (tokenHoldersEntry) {
      startBlock = tokenHoldersEntry.last_block_fetched;
      tokenHoldersEntry.holders.forEach(holder => holders.set(holder.address, holder.balance));
    }
    
    for (
      let fromBlock = startBlock;
      fromBlock <= currentBlock;
      fromBlock += batchSize
    ) {
      try {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
        console.log(`Fetching events from block ${fromBlock} to ${toBlock}...`);
        
        await sleep(500);

        const events = await tokenContract.queryFilter(
          tokenContract.filters.Transfer(),
          fromBlock,
          toBlock
        );          

        for (const event of events) {
          try {
            if (!("args" in event && event.args)) throw new Error(`Skipping event without args: ${JSON.stringify(event)}`);

            const transferEvent = event.args as unknown as TransferEventArgs;
            TransferArgsSchema.parse(transferEvent);

            const from = transferEvent.from;
            const to = transferEvent.to;
            const value = parseFloat(
              ethers.formatUnits(transferEvent.value, Number(decimals))
            );

            if (!holders.has(from)) holders.set(from, 0);
            if (!holders.has(to)) holders.set(to, 0);

            holders.set(from, (holders.get(from) || 0) - value);
            holders.set(to, (holders.get(to) || 0) + value);
          } catch (err) {
            console.log(`Error in event block batching child fetchHolders: ${err}`);
            await logErrorEmbed(`Error in event block batching child fetchHolders: ${err}`);
            continue;
          }
        }
      } catch (err) {
        console.log(`Error in event block batching parent fetchHolders: ${err}`);
        await logErrorEmbed(`Error in event block batching parent fetchHolders: ${err}`);
        continue;
      };
    };

    // Filter holders and sort by balance    
    const filteredHolders: [string, number][] = Array.from(holders.entries())
      .filter(([_, balance]) => balance > minBalanceThreshold)
      .sort((a, b) => b[1] - a[1]);

    if (filteredHolders.length === 0) throw new Error("No token holders found");

    /*const holdersArray = filteredHolders.map(holder => {
      return {
        address: holder[0],
        balance: holder[1],
      }
    });*/

    const holdersArray = filteredHolders.map(
      ([address, balance]) => ({
        address,
        balance,
      })
    );

    const constructedEntry = {
      token_address: tokenAddress,
      initial_block_fetched: tokenHoldersEntry ? tokenHoldersEntry.initial_block_fetched : initialBlock,
      last_block_fetched: currentBlock,
      holders: holdersArray
    };


    await TokenHoldersModel.updateOne(
      { token_address: tokenAddress },
      { $set: constructedEntry },
      { upsert: true }
    );


    // Get top 10 holders and identify wallet/contract
    const topHolders: TopHolder[] = await Promise.all(
      filteredHolders.slice(0, 10).map(async ([address, token_amount]) => {
        try {
          const code = await provider.getCode(address);
          const type = code !== "0x" ? "contract" : "wallet";
          return { 
            address,
            token_amount,
            account_type: type
          };
        } catch (err) {
          console.error(
            `Error fetching code for address ${address}: ${err}`
          );
          return {
            address,
            token_amount,
            account_type: "unknown"
          };
        }
      })
    );

    // Calculate the proportion of tokens held by the top 10 holders
    const totalTopHoldersBalance = topHolders.reduce(
      (sum, holder) => sum + holder.token_amount,
      0
    );
    const topHoldersProportion =
      totalSupply > 0 ? (totalTopHoldersBalance / parsedTotalSupply) * 100 : 0;

    return {
      totalSupply: parsedTotalSupply,
      allHolders: holdersArray,
      topHoldersProportion: Number(topHoldersProportion.toFixed(2)),
      topHolders,
    }
  } catch (err) {
    console.error("Error in parent fetchHolders function", err);
    await logErrorEmbed(`Error in parent fetchHolders function: ${err}`);
    return null;
  }
};


interface PercentileStat {
  range: string;
  accounts: number;
  percent_tokens_held: number;
  amount_tokens_held: string;
}

interface CalculateStatsResponse {
  totalHolders: number;
  averageBalance: number;
  medianBalance: number;
  groupStats: PercentileStat[];
}


const walletGroups: {
  percentage: number;
  rangeStart: number;
  rangeEnd: number;
}[] = [
  { percentage: 10, rangeStart: 0, rangeEnd: 10 },
  { percentage: 25, rangeStart: 10, rangeEnd: 25 },
  { percentage: 50, rangeStart: 25, rangeEnd: 50 },
  { percentage: 80, rangeStart: 50, rangeEnd: 80 },
];

function calculateStats(holdersArray: Holder[], totalSupply: number): CalculateStatsResponse | null {
  try {
    const totalHolders = holdersArray.length;
    //holdersArray.sort((a, b) => b.balance - a.balance);  // order is already in highest -> lowest 
    

    // Group stats for each percentage range
    const groupStats: PercentileStat[] = walletGroups.map(
      ({ rangeStart, rangeEnd }) => {

        const rangeStartIndex = Math.floor((rangeStart / 100) * totalHolders);
        const rangeEndIndex = Math.floor((rangeEnd / 100) * totalHolders);
        const walletsInRange = holdersArray.slice(rangeStartIndex, rangeEndIndex);

        const cumulativeBalance = walletsInRange.reduce(
          (total, { balance }) => total + balance,
          0
        );
        // percent of supply held by wallets in range of the lower and upper bound
        const percent_tokens_held =
          totalSupply > 0 ? (cumulativeBalance / totalSupply) * 100 : 0;

        return {
          range: `${rangeStart}-${rangeEnd}%`,
          accounts: walletsInRange.length,
          percent_tokens_held,
          amount_tokens_held: cumulativeBalance.toFixed(2),
        };
      }
    );

    const averageBalance = totalHolders > 0 ? totalSupply / totalHolders : 0;

    // Median balance calculation
    const middleIndex = Math.floor(totalHolders / 2);
    let medianBalance: number = 0;
    if (totalHolders !== 0) {
      if (totalHolders % 2 === 0) {
        // if token holders is a even number that is not 0 average the two middle values possible simplify in future
        medianBalance =
          (holdersArray[middleIndex - 1].balance +
            holdersArray[middleIndex].balance) /
          2;
      } else {
        medianBalance = holdersArray[middleIndex].balance;
      }
    }

    return {
      totalHolders,
      averageBalance: Number(averageBalance.toFixed(2)),
      medianBalance: Number(medianBalance.toFixed(2)),
      groupStats,
    };
  } catch (err) {
    console.error(`Error calculating token stats: ${err}`);
    logErrorEmbed(`Error calculating token stats: ${err}`); // fire and forget, should never run in theory errors should be caught earlier
    return null;
  }
}

// Interface for final response
/*export interface TokenStatsResponse {
  tokenStats: {
    totalSupply: number;
    marketCap: number | null;
    topHoldersProportion: string | number;
    topHolders: TopHolder[];
  };
  stats: CalculateStatsResponse;
}*/

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
  startBlock: number,
): Promise<TokenStatsResponse | null> {
  try {
    const [holdersStats, marketCap] = await Promise.all([
      await fetchHolders(
        tokenAddress,
        startBlock,
      ),
      await fetchMarketCap(tokenSymbol)
    ]);

    if (!holdersStats) throw new Error("Failed to fetch holders stats, fetchHolders returned null");

    const calculatedStats = calculateStats(holdersStats.allHolders, holdersStats.totalSupply);
    if (!calculatedStats) throw new Error("Failed to calculate holders stats, calculateStats returned null");

    /*const tokenStats = {
      totalSupply: holdersStats.totalSupply,
      marketCap,
      topHoldersProportion: holdersStats.topHolders.topHoldersProportion,
      topHolders: holdersStats.topHolders.topHolders,
    };

    return {
      tokenStats,
      stats: calculatedStats,
    };*/


    return {...holdersStats, ...calculatedStats, marketCap}

  } catch (error: any) {
    console.error(`Error in getTokenStats: ${error.message}`);
    return null;
  }
}

export default getTokenStats;
