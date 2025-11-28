import axios from "axios";

// GraphQL endpoint
const GRAPHQL_ENDPOINT = "https://public.zapper.xyz/graphql";

// Define chain mapping type
type Chain = "eth" | "sol" | "base" | "poly" | "btc" | "arb";

// Define expected wallet data structure
interface WalletData {
  [address: string]: {
    chain: Chain;
  };
}

// GraphQL response typing (simplified)
interface Holdings {
  balanceUSD: string;
}

interface PortfolioResponse {
  data: {
    portfolio: {
      totals: {
        holdings: Holdings[];
      };
    };
  };
}

// Function to send a query for each address
async function getAssetsManaged(walletData: WalletData): Promise<number> {
  let totalUsd = 0;
  const API_KEY = process.env.ZAPPER_KEY;

  if (!API_KEY) {
    console.error("ZAPPER_KEY is not set in environment variables");
    return totalUsd;
  }

  let encodedKey: string;
  try {
    encodedKey = Buffer.from(API_KEY).toString("base64");
  } catch (error) {
    console.error("Error encoding API key:", error);
    return totalUsd;
  }

  const networkMapping: Record<Chain, string> = {
    eth: "ETHEREUM_MAINNET",
    sol: "SOLANA_MAINNET",
    base: "BASE_MAINNET",
    poly: "POLYGON_MAINNET",
    btc: "BITCOIN_MAINNET",
    arb: "ARBITRUM_MAINNET",
  };

  for (const [address, { chain }] of Object.entries(walletData)) {
    const network = networkMapping[chain] || "ETHEREUM_MAINNET";

    const query = `
      query($portfolioAddresses2: [Address!]!, $networks: [Network!]) {
        portfolio(addresses: $portfolioAddresses2, networks: $networks) {
          totals {
            holdings {
              balanceUSD
            }
          }
        }
      }
    `;

    const variables = {
      portfolioAddresses2: [address],
      networks: [network],
    };

    try {
      const response = await axios.post<PortfolioResponse>(
        GRAPHQL_ENDPOINT,
        { query, variables },
        {
          headers: {
            "Content-Type": "application/json",
            authorization: `Basic ${encodedKey}`,
          },
        }
      );

      const holdings = response.data?.data?.portfolio?.totals?.holdings;

      if (holdings && Array.isArray(holdings)) {
        const balanceUSD = holdings.reduce((sum, h) => {
          return sum + (parseFloat(h.balanceUSD) || 0);
        }, 0);
        totalUsd += balanceUSD;
      } else {
        console.warn(
          `Unexpected response format for address ${address}`,
          response.data
        );
      }
    } catch (error) {
      console.error(`Error fetching data for ${address}:`, error);
    }
  }

  return totalUsd;
}

export default getAssetsManaged;
