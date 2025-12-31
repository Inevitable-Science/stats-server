import { ChainId } from "../../../config/constants";
import { logErrorEmbed } from "../../../utils/coms/logAction";
import { ENV } from "../../../utils/env";
import request, { gql } from "graphql-request";
import z from "zod";


// Mapping of chainId's to subgraph endpoints
const SUBGRAPH_ENDPOINTS: Record<ChainId, string> = {
  1: "https://gateway.thegraph.com/api/subgraphs/id/DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G",
  8453: "https://gateway.thegraph.com/api/subgraphs/id/HNCFA9TyBqpo5qpe6QreQABAA1kV8g46mhkCcicu6v2R",
  10: "https://gateway.thegraph.com/api/subgraphs/id/6RBtsmGUYfeLeZsYyxyKSUiaA6WpuC69shMEQ1Cfuj9u",
  42161: "https://gateway.thegraph.com/api/subgraphs/id/G5TsTKNi8yhPSV7kycaE23oWbqv9zzNqR49FoEQjzq1r"
};

const SubgraphResponseZ = z.object({
  pool: z.object({
    totalValueLockedUSD: z.string()
  }),
});

export async function fetchUniV4PoolHoldings(poolId: string, chainId: ChainId): Promise<number | null> {
  try {
    const SUBGRAPH_ENDPOINT = SUBGRAPH_ENDPOINTS[chainId];
    const QUERY = gql`
      query V4PoolQuery($poolId: String!) {
        pool(id: $poolId) {
          totalValueLockedUSD
        }
      }
    `;

    const response = await request(
      SUBGRAPH_ENDPOINT,
      QUERY,
      { poolId },
      {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ENV.SUBGRAPH_KEY}`,
      }
    );

    const parsedResponse = SubgraphResponseZ.parse(response);
    const holdings = parsedResponse.pool.totalValueLockedUSD;
    return Number(holdings);
  } catch (err) {
    await logErrorEmbed(err);
    return null;
  }
};
