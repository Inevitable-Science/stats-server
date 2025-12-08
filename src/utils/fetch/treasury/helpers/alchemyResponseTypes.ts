import z from "zod";

export const AlchemyChainSubdomain = {
  1: "eth-mainnet",
  8453: "base-mainnet",
  10: "opt-mainnet",
  42161: "arb-mainnet",
};

export const genericAlchemyResponse = <T extends z.ZodTypeAny>(resultSchema: T) =>
  z.object({
    id: z.number(),
    jsonrpc: z.string(),
    result: resultSchema,
  });

export const AlchemyEthBalResponseZ = genericAlchemyResponse(z.string());
export type AlchemyEthBalResponseType = z.infer<typeof AlchemyEthBalResponseZ>;

export const AlchemyEthPriceResponseZ = z.object({
  data: z.array(
    z.object({
      symbol: z.string(),
      prices: z.array(
        z.object({
          currency: z.string(),
          value: z.string(),
        })
      ),
    })
  ),
});
export type AlchemyEthPriceResponseType = z.infer<typeof AlchemyEthPriceResponseZ>;

export const AlchemyTokenBalanceResponseSchemaZ = genericAlchemyResponse(
  z.object({
    address: z.string(),
    tokenBalances: z.array(
      z.object({
        contractAddress: z.string(),
        tokenBalance: z.string(),
      })
    ),
  })
);
export type AlchemyTokenBalanceResponseSchemaType = z.infer<
  typeof AlchemyTokenBalanceResponseSchemaZ
>;

export const AlchemyTokenBalancesSchemaZ = genericAlchemyResponse(
  z.object({
    //address: z.string(),
    tokenBalances: z.array(
      z.object({
        contractAddress: z.string(),
        tokenBalance: z.string(),
      })
    ),
  })
);
export type AlchemyTokenBalancesSchemaType = z.infer<typeof AlchemyTokenBalancesSchemaZ>;

export const AlchemyTokenMetadataSchemaZ = genericAlchemyResponse(
  z.object({
    name: z.string().nullable(),
    symbol: z.string().nullable(),
    decimals: z.number().nullable(),
    logo: z.string().nullable(),
  })
);
export type AlchemyTokenMetadataSchemaType = z.infer<typeof AlchemyTokenMetadataSchemaZ>;

export const AlchemyTokenPriceSchemaZ = z.object({
  data: z.array(
    z.object({
      network: z.string(),
      address: z.string(),
      prices: z.array(
        z.object({
          currency: z.string(),
          value: z.string(),
        })
      ),
    })
  ),
});
export type AlchemyTokenPriceSchemaType = z.infer<typeof AlchemyTokenPriceSchemaZ>;
