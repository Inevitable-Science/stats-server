import axios, { AxiosResponse } from "axios";
import { ENV } from "../env";

// Interface for pegged token configuration
interface PeggedToken {
  tokenAddress: string;
  peggedPrice: string;
  customName: string;
}

// Interface for Alchemy token balance response
interface TokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

// Interface for Alchemy token metadata response
interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number; // Changed to number with fallback in fetchTokenMetadata
  logo?: string;
}

// Interface for Alchemy API response
interface AlchemyResponse<T> {
  id: number;
  jsonrpc: string;
  result: T;
}

// Interface for Alchemy price response
interface AlchemyPriceResponse {
  data: Array<{
    prices: Array<{
      value: string;
    }>;
  }>;
}

// Interface for wallet data entry
export interface WalletData {
  contractAddress: string | null;
  metadata: {
    name: string;
    symbol?: string;
    decimals: number;
    logo?: string;
  };
  rawBalance: string;
  decodedBalance: string;
  price: string | null;
  totalValue: string;
}

// Interface for treasury holdings response
export interface TreasuryHoldings {
  usdBalance: string;
  tokens: WalletData[] | null;
}

// Pegged tokens configuration
const peggedTokens: PeggedToken[] = [
  {
    tokenAddress: "0x0d2ADB4Af57cdac02d553e7601456739857D2eF4",
    peggedPrice: "0xcb1592591996765Ec0eFc1f92599A19767ee5ffA",
    customName: "vBIO",
  },
];

// API keys and endpoints
const ALCHEMY_API_KEY = ENV.ALCHEMY_KEY;
const ALCHEMY_MAINNET_URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const ALCHEMY_PRICE_URL = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-address`;

async function fetchWithRetry<T>(
  url: string,
  payload: any,
  maxRetries: number = 7,
  delay: number = 1000
): Promise<T> {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const response: AxiosResponse<T> = await axios.post(url, payload, {
        timeout: 20000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers["retry-after"];
        const waitTime = retryAfter
          ? parseFloat(retryAfter) * 1000
          : delay * Math.pow(2, attempts);
        console.warn(`Rate limited. Retrying in ${waitTime / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error; // Re-throw other errors
      }
    }
    attempts++;
  }

  throw new Error(`Max retries exceeded for ${url}`);
}

async function fetchTokenBalances(
  walletAddress: string
): Promise<TokenBalance[]> {
  const payload = {
    id: 1,
    jsonrpc: "2.0",
    method: "alchemy_getTokenBalances",
    params: [walletAddress],
  };
  const data = await fetchWithRetry<
    AlchemyResponse<{ tokenBalances: TokenBalance[] }>
  >(ALCHEMY_MAINNET_URL, payload);
  return data.result.tokenBalances;
}

async function fetchTokenPrice(
  contractAddress: string
): Promise<number | null> {
  const payload = {
    addresses: [
      {
        network: "eth-mainnet",
        address: contractAddress,
      },
    ],
  };
  try {
    const data = await fetchWithRetry<AlchemyPriceResponse>(
      ALCHEMY_PRICE_URL,
      payload
    );
    const prices = data.data[0]?.prices;
    if (!prices || prices.length === 0) return null;
    return parseFloat(prices[0].value);
  } catch (error: any) {
    console.error(
      `Error fetching price for ${contractAddress}: ${error.message}`
    );
    return null;
  }
}

async function fetchEthPrice(): Promise<string | null> {
  const url = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-symbol?symbols=ETH`;
  try {
    const response = await axios.get<AlchemyPriceResponse>(url, {
      timeout: 20000,
    });
    if (response.status !== 200) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const prices = response.data?.data?.[0]?.prices;
    if (!prices || prices.length === 0) return null;
    return parseFloat(prices[0].value).toFixed(2);
  } catch (error: any) {
    console.error(`Error fetching ETH price: ${error.message}`);
    return null;
  }
}

async function fetchTokenMetadata(
  contractAddress: string
): Promise<TokenMetadata> {
  const payload = {
    id: 1,
    jsonrpc: "2.0",
    method: "alchemy_getTokenMetadata",
    params: [contractAddress],
  };
  const data = await fetchWithRetry<AlchemyResponse<Partial<TokenMetadata>>>(
    ALCHEMY_MAINNET_URL,
    payload
  );
  // Ensure decimals is a number, default to 18 if null or undefined
  return {
    name: data.result.name || "Unknown",
    symbol: data.result.symbol || "UNKNOWN",
    decimals: data.result.decimals ?? 18, // Fallback to 18
    logo: data.result.logo,
  };
}

// Decode token balance
function decodeHexBalance(hexBalance: string, decimals: number): number {
  try {
    return parseInt(hexBalance, 16) / Math.pow(10, decimals);
  } catch (error: any) {
    console.error(`Error decoding balance for ${hexBalance}: ${error.message}`);
    return 0; // Fallback to 0 for invalid hex balance
  }
}

// Main function
async function getTreasuryHoldings(
  walletAddress: string
): Promise<TreasuryHoldings> {
  try {
    if (!ALCHEMY_API_KEY) {
      throw new Error("Alchemy API key not provided");
    }

    const walletData: WalletData[] = [];
    let totalUsdBalance = 0;

    // Fetch ETH balance
    const ethBalancePayload = {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [walletAddress, "latest"],
    };
    let ethBalanceHex: string;
    try {
      const ethResponse = await axios.post<AlchemyResponse<string>>(
        ALCHEMY_MAINNET_URL,
        ethBalancePayload,
        { timeout: 20000 }
      );
      ethBalanceHex = ethResponse?.data?.result;
      if (!ethBalanceHex) {
        throw new Error("No ETH balance returned");
      }
    } catch (error: any) {
      console.error(`Failed to fetch ETH balance: ${error.message}`);
      return { usdBalance: "0.00", tokens: [] }; // Return default empty response
    }

    const ethBalanceDecoded = decodeHexBalance(ethBalanceHex, 18); // ETH has 18 decimals
    const ethPrice = await fetchEthPrice();
    const ethTotalValue =
      ethPrice !== null ? ethBalanceDecoded * parseFloat(ethPrice) : 0;

    if (ethBalanceDecoded > 0) {
      walletData.push({
        contractAddress: null,
        metadata: { name: "Ether", symbol: "ETH", decimals: 18 },
        rawBalance: ethBalanceHex,
        decodedBalance: ethBalanceDecoded.toFixed(2),
        price: ethPrice,
        totalValue: ethTotalValue.toFixed(2),
      });
      totalUsdBalance += ethTotalValue;
    }

    // Fetch other token balances
    const tokenBalances = await fetchTokenBalances(walletAddress);
    for (const token of tokenBalances) {
      const contractAddress = token?.contractAddress?.toLowerCase();
      const rawBalance = token?.tokenBalance;

      if (!contractAddress || !rawBalance) {
        console.warn(
          `Skipping invalid token balance: ${JSON.stringify(token)}`
        );
        continue;
      }

      let metadata: TokenMetadata;
      try {
        metadata = await fetchTokenMetadata(contractAddress);
      } catch (error: any) {
        console.error(
          `Error fetching metadata for ${contractAddress}: ${error.message}`
        );
        continue; // Skip token if metadata fetch fails
      }

      const decimals = metadata.decimals; // Now guaranteed to be a number
      const decodedBalance = decodeHexBalance(rawBalance, decimals);

      if (decodedBalance === 0) continue; // Skip if balance is zero

      let price: number | null;
      let totalValue: number;
      let customName: string | null = null;

      // Check if the token is in peggedTokens
      const peggedToken = peggedTokens.find(
        (pegged) => pegged.tokenAddress.toLowerCase() === contractAddress
      );

      if (peggedToken) {
        customName = peggedToken.customName;
        if (peggedToken?.peggedPrice) {
          price = await fetchTokenPrice(peggedToken.peggedPrice.toLowerCase());
        } else {
          console.warn(`No pegged price for token ${contractAddress}`);
          continue;
        }
        if (price === null) {
          console.warn(
            `Failed to fetch price for pegged token ${peggedToken.peggedPrice}`
          );
          continue;
        }
        totalValue = Number((decodedBalance * price).toFixed(2));
      } else {
        price = await fetchTokenPrice(contractAddress);
        if (price === null) {
          console.warn(`Failed to fetch price for token ${contractAddress}`);
          continue;
        }
        totalValue = Number((decodedBalance * price).toFixed(2));
      }

      if (Math.round(totalValue) === 0) continue;

      totalUsdBalance += totalValue;

      walletData.push({
        contractAddress,
        metadata: {
          ...metadata,
          name: customName || metadata.name,
        },
        rawBalance,
        decodedBalance: decodedBalance.toFixed(2),
        price: price !== null ? price.toFixed(2) : null,
        totalValue: totalValue.toFixed(2),
      });
    }

    return {
      usdBalance: totalUsdBalance.toFixed(2),
      tokens: walletData,
    };
  } catch (err: any) {
    console.error(`Error fetching treasury holdings: ${err.message}`);
    return {
      usdBalance: "0.00",
      tokens: [],
    };
  }
}

export default getTreasuryHoldings;
