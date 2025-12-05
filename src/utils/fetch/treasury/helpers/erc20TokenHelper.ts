import { ChainId } from "../../../../config/constants";
import { ENV } from "../../../../utils/env";
import { Address } from "viem";
import { AlchemyChainSubdomain, AlchemyTokenBalancesSchemaType, AlchemyTokenBalancesSchemaZ, AlchemyTokenMetadataSchemaType, AlchemyTokenMetadataSchemaZ, AlchemyTokenPriceSchemaType, AlchemyTokenPriceSchemaZ } from "./alchemyResponseTypes";
import { fetchWithRetry } from "./fetchWithRetry";
import { logErrorEmbed } from "../../../../utils/coms/logAction";

const ALCHEMY_API_KEY = ENV.ALCHEMY_KEY;


interface FetchAllTokenBalancesResponse {
  contractAddress: Address;
  tokenBalance: string;
}

export async function fetchAllTokenBalances(
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


export async function fetchTokenPrice(
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

export async function fetchTokenMetadata(
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
