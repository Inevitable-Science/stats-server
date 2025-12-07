import axios from "axios";
import type { Address } from "viem";

import type { ChainId } from "../../../../config/constants";
import { logErrorEmbed } from "../../../../utils/coms/logAction";
import { ENV } from "../../../../utils/env";
import { decodeHexBalance } from "../treasuryHoldings";

import {
  AlchemyChainSubdomain,
  AlchemyEthBalResponseZ,
  AlchemyEthPriceResponseZ,
} from "./alchemyResponseTypes";
import { fetchWithRetry } from "./fetchWithRetry";



const ALCHEMY_API_KEY = ENV.ALCHEMY_KEY;

export async function fetchEthPrice(): Promise<number | null> {
  try {
    const ALCHEMY_ETH_PRICE_URL = `https://api.g.alchemy.com/prices/v1/${ALCHEMY_API_KEY}/tokens/by-symbol?symbols=ETH`;
    const response = await axios.get(ALCHEMY_ETH_PRICE_URL, {
      timeout: 20000,
    });

    const data = await response.data;
    const parsed = AlchemyEthPriceResponseZ.parse(data);
    const price = parsed.data[0].prices[0].value;
    if (!price || typeof price !== "string")
      throw new Error("ETH Price Not Found In Response");

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
}

export async function fetchEthHoldings(
  walletAddress: Address,
  chainId: ChainId
): Promise<FetchEthHoldingsResponse | null> {
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
      ethBalancePayload
    );

    const parsed = AlchemyEthBalResponseZ.parse(response);
    const ethBalanceHex = parsed.result;

    const ethBalanceDecoded = decodeHexBalance(ethBalanceHex, 18); // ETH = 18 decimals
    const ethPrice = await fetchEthPrice();
    if (!ethPrice) throw new Error("No ETH Price Returned");

    const ethTotalValue = ethPrice ? ethBalanceDecoded * ethPrice : 0;

    return {
      hexBalance: ethBalanceHex,
      ethBalance: ethBalanceDecoded,
      ethPrice: ethPrice,
      totalValue: ethTotalValue,
    };
  } catch (err) {
    await logErrorEmbed(
      `Error in fetchEthHoldings For: ${walletAddress}: ${err}`
    );
    return null;
  }
}
