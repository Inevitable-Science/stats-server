import request, { gql } from "graphql-request";
import type { Address } from "viem";
import z from "zod";

import { logErrorEmbed } from "../../coms/logAction";
import { ENV } from "../../env";

import type { ChainId } from "@/config/constants";

const PortfolioSchemaZ = z.object({
  portfolioV2: z.object({
    tokenBalances: z.object({
      totalBalanceUSD: z.number().nullable(),
    }),
    appBalances: z.object({
      totalBalanceUSD: z.number().nullable(),
    }),
  }),
});

// Function to send a query for each address
async function getAssetsManaged(walletAddresses: Address[], chainId: ChainId[]): Promise<number> {
  try {
    const GRAPHQL_ENDPOINT = "https://public.zapper.xyz/graphql";
    const QUERY = gql`
      query AssetsManaged($addresses: [Address!]!, $chainIds: [Int!]) {
        portfolioV2(addresses: $addresses, chainIds: $chainIds) {
          tokenBalances {
            totalBalanceUSD
          }
          appBalances {
            totalBalanceUSD
          }
        }
      }
    `;

    const response = await request(
      GRAPHQL_ENDPOINT,
      QUERY,
      { addresses: walletAddresses, chainIds: chainId },
      {
        "Content-Type": "application/json",
        "x-zapper-api-key": ENV.ZAPPER_KEY,
      }
    );

    const data = PortfolioSchemaZ.parse(response).portfolioV2;
    const totalBal =
      (data.tokenBalances.totalBalanceUSD ?? 0) + (data.appBalances.totalBalanceUSD ?? 0);

    if (totalBal === 0) {
      const message = `AUM is $0 for addresses \`${walletAddresses.join(", ")}\` and chains \`${chainId.join(", ")}\``;
      await logErrorEmbed(message);
    }

    return totalBal;
  } catch (err) {
    await logErrorEmbed(err);
    return 0;
  }
}

export default getAssetsManaged;
