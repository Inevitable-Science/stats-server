import { Address, zeroAddress } from "viem";
import { ChainId } from "../../../config/constants";
import { logErrorEmbed } from "../../coms/logAction";
import { fetchEthHoldings } from "./helpers/ethAccountHelper";
import { fetchAllTokenBalances, fetchTokenMetadata, fetchTokenPrice } from "./helpers/erc20TokenHelper";

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

// Decode token balance
export function decodeHexBalance(hexBalance: string, decimals: number): number {
  try {
    return parseInt(hexBalance, 16) / Math.pow(10, decimals);
  } catch (error: any) {
    console.error(`Error decoding balance for ${hexBalance}: ${error.message}`);
    return 0; // Fallback to 0 for invalid hex balance
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
