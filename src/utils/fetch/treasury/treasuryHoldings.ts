import { Address, zeroAddress } from "viem";
import axios, { AxiosResponse } from "axios";
import { ENV } from "../../env";
import { ChainId } from "../../../config/constants";
import { logErrorEmbed } from "../../coms/logAction";
import { AlchemyChainSubdomain, AlchemyEthBalResponseZ, AlchemyEthPriceResponseZ, AlchemyTokenBalancesSchemaType, AlchemyTokenBalancesSchemaZ, AlchemyTokenMetadataSchemaType, AlchemyTokenMetadataSchemaZ, AlchemyTokenPriceSchemaType, AlchemyTokenPriceSchemaZ } from "./alchemyResponseTypes";

// Interface for wallet data entry
export interface TokenData {
  contractAddress: Address;
  metadata: {
    name: string;
    symbol: string;
    decimals: number;
    logo?: string;
  };
  rawBalance: string;
  decodedBalance: number;
  price: number;
  totalValue: number;
}

// Interface for treasury holdings response
export interface TreasuryHoldingsResponse {
  usdBalance: string;
  tokens: TokenData[];
}

// Interface for pegged token configuration
interface PeggedToken {
  tokenAddress: Address;
  peggedPrice: Address;
  customName: string;
}

// Pegged tokens configuration
const peggedTokens: PeggedToken[] = [
  {
    tokenAddress: "0x0d2ADB4Af57cdac02d553e7601456739857D2eF4",
    peggedPrice: "0xcb1592591996765Ec0eFc1f92599A19767ee5ffA",
    customName: "vBIO",
  },
];

const ALCHEMY_API_KEY = ENV.ALCHEMY_KEY;

async function fetchWithRetry<T>(
  url: string,
  payload: any,
  maxRetries: number = 7,
  delay: number = 1000
): Promise<T> {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response: AxiosResponse<T> = await axios.post(url, payload, { timeout: 20000 });
      const data = await response.data;
      return data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = parseFloat(error.response.headers["retry-after"] || "");
        const waitTime = !isNaN(retryAfter) ? retryAfter * 1000 : delay * 2 ** attempt;
        console.warn(`Rate limited. Retrying in ${waitTime / 1000} seconds...`);

        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Max retries exceeded for ${url}`);
}

interface FetchAllTokenBalancesResponse {
  contractAddress: Address;
  tokenBalance: string;
}

async function fetchAllTokenBalances(
  walletAddress: Address,
  chainId: ChainId
): Promise<FetchAllTokenBalancesResponse[] | null> {
  try {
    const SUBDOMAIN = AlchemyChainSubdomain[chainId];
    const ALCHEMY_TOKEN_BAL_URL = `https://${SUBDOMAIN}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    
    const payload = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getTokenBalances",
      params: [walletAddress],
    };

    const response = await fetchWithRetry<AlchemyTokenBalancesSchemaType>(ALCHEMY_TOKEN_BAL_URL, payload);
    const parsed = AlchemyTokenBalancesSchemaZ.parse(response);
    const mapppedTokens = parsed.result.tokenBalances.map(tkn => {
      return {
        contractAddress: tkn.contractAddress as Address,
        tokenBalance: tkn.tokenBalance,
      }
    });

    return mapppedTokens;
  } catch (err) {
    await logErrorEmbed(`Error in fetchAllTokenBalances For ${walletAddress}: ${err}`);
    return null;
  };
}

async function fetchTokenPrice(
  contractAddress: Address,
  chainId: ChainId
): Promise<number | null> {
  try {
    const NETWORK_STRING = AlchemyChainSubdomain[chainId];
    const ALCHEMY_TOKEN_PRICE_URL = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-address`;
    const payload = {
      addresses: [
        {
          network: NETWORK_STRING,
          address: contractAddress.toLowerCase(),
        },
      ],
    };

    const response = await fetchWithRetry<AlchemyTokenPriceSchemaType>(
      ALCHEMY_TOKEN_PRICE_URL,
      payload
    );
    const parsed = AlchemyTokenPriceSchemaZ.parse(response);

    const prices = parsed.data[0].prices;
    const usdPrice = prices.find(obj => obj.currency === "usd");

    if (!usdPrice?.value) return null;
    return parseFloat(usdPrice.value);

  } catch (err) {
    await logErrorEmbed(`Error fetching price for ${contractAddress} - ${chainId}: ${err}`);
    return null;
  }
}

interface FetchTokenMetadataResponse {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

async function fetchTokenMetadata(
  contractAddress: Address,
  chainId: ChainId
): Promise<FetchTokenMetadataResponse | null> {
  try {
    const SUBDOMAIN = AlchemyChainSubdomain[chainId];
    const ALCHEMY_TOKEN_METADATA_URL = `https://${SUBDOMAIN}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    const payload = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getTokenMetadata",
      params: [contractAddress.toLowerCase()],
    };

    const response = await fetchWithRetry<AlchemyTokenMetadataSchemaType>(
      ALCHEMY_TOKEN_METADATA_URL,
      payload
    );

    const parsed = AlchemyTokenMetadataSchemaZ.parse(response);
    const data = parsed.result;
    if (!data.name || !data.symbol || !data.decimals) throw new Error(`Name, Symbol or Decimals missing in metadata response`);

    return {
      name: data.name,
      symbol: data.symbol,
      decimals: data.decimals,
      logo: data.logo ?? "",
    };
  } catch (err) {
    return null;
  }
};

// Decode token balance
function decodeHexBalance(hexBalance: string, decimals: number): number {
  try {
    return parseInt(hexBalance, 16) / Math.pow(10, decimals);
  } catch (error: any) {
    console.error(`Error decoding balance for ${hexBalance}: ${error.message}`);
    return 0; // Fallback to 0 for invalid hex balance
  }
}

async function fetchEthPrice(): Promise<number | null> {
  try {
    const ALCHEMY_ETH_PRICE_URL = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-symbol?symbols=ETH`;
    const response = await axios.get(ALCHEMY_ETH_PRICE_URL, {
      timeout: 20000,
    });

    const data = await response.data;
    const parsed = AlchemyEthPriceResponseZ.parse(data);
    const price = parsed.data[0].prices[0].value;
    if (!price || typeof price !== "string") throw new Error("ETH Price Not Found In Response");

    const roundedPrice = Number(price);
    return roundedPrice;
  } catch (err) {
    await logErrorEmbed(`Error in fetchEthPrice: ${err}`);
    return null;
  }
}

interface FetchEthHoldingsResponse {
  hexBalance: string;
  ethBalance: number;
  ethPrice: number;
  totalValue: number;
};

async function fetchEthHoldings(walletAddress: Address, chainId: ChainId): Promise<FetchEthHoldingsResponse | null> {
  try {
    const SUBDOMAIN = AlchemyChainSubdomain[chainId];
    const ALCHEMY_ETH_BAL_URL = `https://${SUBDOMAIN}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

    const ethBalancePayload = {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [walletAddress, "latest"],
    };

    const response = await fetchWithRetry(
      ALCHEMY_ETH_BAL_URL,
      ethBalancePayload,
    );

    const parsed = AlchemyEthBalResponseZ.parse(response);
    const ethBalanceHex = parsed.result;

    const ethBalanceDecoded = decodeHexBalance(ethBalanceHex, 18); // ETH = 18 decimals
    const ethPrice = await fetchEthPrice();
    if (!ethPrice) throw new Error("No ETH Price Returned");

    const ethTotalValue =
      ethPrice ? ethBalanceDecoded * ethPrice : 0;

    return {
      hexBalance: ethBalanceHex,
      ethBalance: ethBalanceDecoded,
      ethPrice: ethPrice,
      totalValue: ethTotalValue,
    };

  } catch (err) {
    await logErrorEmbed(`Error in fetchEthHoldings For: ${walletAddress}: ${err}`);
    return null;
  }
}


// Main function
async function getTreasuryHoldings(
  walletAddress: Address,
  chainId: ChainId
): Promise<TreasuryHoldingsResponse> {
  try {
    const walletData: TokenData[] = [];
    let totalUsdBalance = 0;

    const ethData = await fetchEthHoldings(walletAddress, chainId);
    if (ethData && ethData.totalValue !== 0) {
      walletData.push({
        contractAddress: zeroAddress,
        metadata: { 
          name: "Ethereum", 
          symbol: "ETH", 
          decimals: 18 
        },
        rawBalance: ethData.hexBalance,
        decodedBalance: Number(ethData.ethBalance.toFixed(4)),
        price: Number(ethData.ethPrice.toFixed(4)),
        totalValue: Number(ethData.totalValue.toFixed(4)),
      });
      totalUsdBalance += ethData.totalValue;
    }

    // Fetch other token balances
    const tokenBalances = await fetchAllTokenBalances(walletAddress, chainId);
    if (!tokenBalances) throw new Error("Couldn't fetch all token balances");

    for (const token of tokenBalances) {
      const matchedPeggedToken = peggedTokens.find(
        peggedTkn => peggedTkn.tokenAddress.toLowerCase() === token.contractAddress.toLowerCase()
      );

      const metadataTokenAddress = matchedPeggedToken ? matchedPeggedToken.tokenAddress : token.contractAddress;
      const priceTokenAddress = matchedPeggedToken ? matchedPeggedToken.peggedPrice : token.contractAddress;

      const tokenMetadata = await fetchTokenMetadata(metadataTokenAddress, chainId);
      if (!tokenMetadata) continue;

      const decodedBalance = decodeHexBalance(token.tokenBalance, tokenMetadata.decimals);
      if (decodedBalance === 0) continue;

      const tokenPrice = await fetchTokenPrice(priceTokenAddress, chainId);
      if (!tokenPrice) continue;

      const totalAssetValue = decodedBalance * tokenPrice;
      if (totalAssetValue < 10) continue;

      totalUsdBalance += Number(totalAssetValue);
      walletData.push({
        contractAddress: token.contractAddress,
        metadata: {
          ...tokenMetadata,
          name: tokenMetadata.name,
        },
        rawBalance: token.tokenBalance,
        decodedBalance: Number(decodedBalance.toFixed(4)),
        price: Number(tokenPrice.toFixed(4)),
        totalValue: Number(totalAssetValue.toFixed(2)),
      });
      continue;
    }

    return {
      usdBalance: totalUsdBalance.toFixed(2),
      tokens: walletData,
    };
  } catch (err) {
    await logErrorEmbed(`Error in treasury handler function ${err}`);
    return {
      usdBalance: "0.00",
      tokens: [],
    };
  }
}

export default getTreasuryHoldings;
