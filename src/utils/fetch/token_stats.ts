import axios, { AxiosResponse } from 'axios';
import { ethers } from 'ethers';

// Interface for CoinGecko API response
interface MarketCapResponse {
  market_data?: {
    market_cap?: {
      usd?: number;
    };
  };
}

// Interface for Transfer event arguments
interface TransferEventArgs {
  from: string;
  to: string;
  value: ethers.BigNumberish;
}

// Interface for Transfer event
interface TransferEvent {
  args: TransferEventArgs;
  transactionHash: string;
}

// Interface for holder data
interface Holder {
  holder: string;
  balance: number;
}

// Interface for top holder data
interface TopHolder {
  address: string;
  balance: number;
  type: 'wallet' | 'contract' | 'unknown';
}

// Interface for holders stats
interface HoldersStats {
  totalSupply: number;
  topHoldersProportion: string | number;
  topHolders: TopHolder[];
  filteredHolders: [string, number][];
}

// Interface for group stats
interface GroupStat {
  percentage: string;
  walletsCount: number;
  walletsHoldingPercentage: number;
  cumulativeBalance: string;
}

// Interface for calculated stats
interface Stats {
  totalWallets: number;
  averageBalance: string;
  medianBalance: string;
  groupStats: GroupStat[];
}

// Interface for token stats
interface TokenStats {
  totalSupply: number;
  marketCap: number | null;
  topHoldersProportion: string | number;
  topHolders: TopHolder[];
}

// Interface for final response
export interface TokenStatsResponse {
  tokenStats: TokenStats;
  stats: Stats;
}

// Set up the provider (Infura or Alchemy endpoint)
const infuraKey: string | undefined = process.env.INFURA_KEY;

async function fetchMarketCap(tokenSymbol: string): Promise<number | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${tokenSymbol}`;
  try {
    const response: AxiosResponse<MarketCapResponse> = await axios.get(url, { timeout: 5000 });
    if (response.status !== 200) {
      console.error(`Unexpected response status: ${response.status}`);
      return null;
    }
    const marketCap = response?.data?.market_data?.market_cap?.usd ?? null;
    return marketCap;
  } catch (error: any) {
    console.error(`Error fetching market cap for ${tokenSymbol}: ${error.message}`);
    return null;
  }
}

async function fetchHolders(
  tokenAddress: string,
  tokenABI: any[], // Consider using ethers.ContractInterface for stricter typing
  startBlock: number,
  decimals: number
): Promise<HoldersStats | null> {
  let provider: ethers.JsonRpcProvider;
  try {
    if (!infuraKey) {
      throw new Error('Infura key not provided');
    }
    provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
  } catch (error: any) {
    console.error(`Failed to initialize provider: ${error.message}`);
    return null;
  }

  const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  let tokenContract: ethers.Contract;
  try {
    tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);
  } catch (error: any) {
    console.error(`Failed to create contract instance: ${error.message}`);
    return null;
  }

  // Get total supply and format it
  let totalSupply: number;
  try {
    const supply = await tokenContract.totalSupply();
    totalSupply = Math.round(parseFloat(ethers.formatUnits(supply, decimals)));
  } catch (error: any) {
    console.error(`Error fetching total supply: ${error.message}`);
    return null;
  }

  const holders: Map<string, number> = new Map();

  let endBlock: number;
  try {
    endBlock = await provider.getBlockNumber();
  } catch (error: any) {
    console.error(`Error fetching latest block number: ${error.message}`);
    return null;
  }

  const batchSize = 100000; // Process events in batches of 100,000 blocks

  for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += batchSize) {
    const toBlock = Math.min(fromBlock + batchSize - 1, endBlock);

    console.log(`Fetching events from block ${fromBlock} to ${toBlock}...`);
    await sleep(500);

    try {
      const events = await tokenContract.queryFilter(tokenContract.filters.Transfer(), fromBlock, toBlock);

      for (const event of events) {
        if ('args' in event && event.args) {
          const transferEvent = event as unknown as TransferEvent;
          if (!transferEvent.args?.from || !transferEvent.args.to || !transferEvent.args.value) {
            console.warn(`Skipping malformed event: ${JSON.stringify(event)}`);
            continue;
          }

          const from: string = transferEvent.args.from;
          const to: string = transferEvent.args.to;
          let value: number;
          try {
            value = parseFloat(ethers.formatUnits(transferEvent.args.value, decimals));
          } catch (error: any) {
            console.warn(
              `Warning: Error parsing value for event ${transferEvent.transactionHash}: ${error.message}`
            );
            continue;
          }

          if (!holders.has(from)) holders.set(from, 0);
          if (!holders.has(to)) holders.set(to, 0);

          holders.set(from, (holders.get(from) || 0) - value);
          holders.set(to, (holders.get(to) || 0) + value);
        } else {
          console.warn(`Skipping event without args: ${JSON.stringify(event)}`);
          continue;
        }
      }
    } catch (error: any) {
      console.error(`Error fetching events from ${fromBlock} to ${toBlock}: ${error.message}`);
      continue;
    }
  }

  // Filter holders and sort by balance
  const minBalanceThreshold = 0.01;
  const filteredHolders: [string, number][] = Array.from(holders.entries())
    .filter(([_, balance]) => balance > minBalanceThreshold)
    .sort((a, b) => b[1] - a[1]);

  // Get top 10 holders and identify wallet/contract
  const topHolders: TopHolder[] = await Promise.all(
    filteredHolders.slice(0, 10).map(async ([address, balance]) => {
      try {
        const code = await provider.getCode(address);
        const type = code !== '0x' ? 'contract' : 'wallet';
        return { address, balance, type };
      } catch (error: any) {
        console.error(`Error fetching code for address ${address}: ${error.message}`);
        return { address, balance, type: 'unknown' };
      }
    })
  );

  // Calculate the proportion of tokens held by the top 10 holders
  const totalTopHoldersBalance = topHolders.reduce((sum, holder) => sum + holder.balance, 0);
  const topHoldersProportion = totalSupply > 0 ? (totalTopHoldersBalance / totalSupply) * 100 : 0;

  if (filteredHolders.length === 0) {
    console.warn('No holders found, returning empty stats.');
    return {
      totalSupply,
      topHoldersProportion: 0,
      topHolders: [],
      filteredHolders: [],
    };
  }

  return {
    totalSupply,
    topHoldersProportion: topHoldersProportion.toFixed(2),
    topHolders,
    filteredHolders,
  };
}

function calculateStats(holdersArray: Holder[]): Stats {
  // Total tokens in circulation (sum of all balances)
  const totalTokens = holdersArray.reduce((total, { balance }) => total + balance, 0);

  holdersArray.sort((a, b) => b.balance - a.balance);

  // Calculate the wallet counts for each percentage group based on ranges
  const totalWallets = holdersArray.length;

  // Define the percentage ranges
  const walletGroups: { percentage: number; rangeStart: number; rangeEnd: number }[] = [
    { percentage: 10, rangeStart: 0, rangeEnd: 10 },
    { percentage: 25, rangeStart: 10, rangeEnd: 25 },
    { percentage: 50, rangeStart: 25, rangeEnd: 50 },
    { percentage: 80, rangeStart: 50, rangeEnd: 80 },
  ];

  // Group stats for each percentage range
  const groupStats: GroupStat[] = walletGroups.map(({ percentage, rangeStart, rangeEnd }) => {
    const rangeStartIndex = Math.floor((rangeStart / 100) * totalWallets);
    const rangeEndIndex = Math.floor((rangeEnd / 100) * totalWallets);
    const walletsInRange = holdersArray.slice(rangeStartIndex, rangeEndIndex);

    const cumulativeBalance = walletsInRange.reduce((total, { balance }) => total + balance, 0);
    const walletsHoldingPercentage = totalTokens > 0 ? (cumulativeBalance / totalTokens) * 100 : 0;

    return {
      percentage: `${rangeStart}-${rangeEnd}%`,
      walletsCount: walletsInRange.length,
      walletsHoldingPercentage,
      cumulativeBalance: cumulativeBalance.toFixed(2),
    };
  });

  // Calculate other stats
  const averageBalance = totalWallets > 0 ? totalTokens / totalWallets : 0;

  // Median balance calculation
  const middleIndex = Math.floor(totalWallets / 2);
  let medianBalance: number;
  if (totalWallets === 0) {
    medianBalance = 0;
  } else if (totalWallets % 2 === 0) {
    medianBalance = (holdersArray[middleIndex - 1].balance + holdersArray[middleIndex].balance) / 2;
  } else {
    medianBalance = holdersArray[middleIndex].balance;
  }

  return {
    totalWallets,
    averageBalance: averageBalance.toFixed(2),
    medianBalance: medianBalance.toFixed(2),
    groupStats,
  };
}

async function getTokenStats(
  tokenSymbol: string,
  tokenAddress: string,
  tokenABI: any[], // Consider using ethers.ContractInterface for stricter typing
  startBlock: number,
  decimals: number
): Promise<TokenStatsResponse | null> {
  try {
    const holdersStats = await fetchHolders(tokenAddress, tokenABI, startBlock, decimals);
    if (!holdersStats) {
      console.error('Failed to fetch holders stats');
      return null;
    }

    const holdersArray: Holder[] = holdersStats.filteredHolders.map(([holder, balance]) => ({
      holder,
      balance,
    }));

    const marketCap = await fetchMarketCap(tokenSymbol);

    // Calculate stats for all wallets
    const stats = calculateStats(holdersArray);

    const tokenStats: TokenStats = {
      totalSupply: holdersStats.totalSupply,
      marketCap,
      topHoldersProportion: holdersStats.topHoldersProportion,
      topHolders: holdersStats.topHolders,
    };

    return {
      tokenStats,
      stats,
    };
  } catch (error: any) {
    console.error(`Error in getTokenStats: ${error.message}`);
    return null;
    /*return {
        tokenStats: {
        totalSupply: 0,
        marketCap: null,
        topHoldersProportion: 0,
        topHolders: [],
      },
      stats: {
        totalWallets: 0,
        averageBalance: '0.00',
        medianBalance: '0.00',
        groupStats: [],
      },
    };*/
  }
}

export default getTokenStats;