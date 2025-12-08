import type { Request, Response } from "express";
import z from "zod";

import { daos } from "../../../config/constants";
import type { TokenDistribution, TopHolder } from "../../../config/models/tokenSchema";
import TokenModel from "../../../config/models/tokenSchema";
import TreasuryModel from "../../../config/models/treasurySchema";
import { logErrorEmbed } from "../../../utils/coms/logAction";
import { ErrorCodes } from "../../../utils/errors";

// Interface for the token response
interface TokenResponse {
  name: string;
  logo: string;
  assetsUnderManagement: number | null;
  selectedToken: {
    address: string;
    chain_id: number;
    logoUrl: string;
    ticker: string;
    name: string;
    parentDao: string;
    networks: string[];
    totalSupply: number;
    marketCap: number;
    averageBal: number;
    medianBal: number;
    totalHolders: string;
  };
  topHolders: TopHolder[];
  tokenDistribution: TokenDistribution[];
}

export async function fetchTokenData(req: Request, res: Response): Promise<void> {
  try {
    const { tokenName } = req.params;
    const parsedToken = z.string().nonempty().parse(tokenName);

    const passedToken = daos.find(
      (d) => d.native_token.name.toLowerCase() === parsedToken.toLowerCase()
    )?.native_token;
    if (!passedToken) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    const [tokenEntry, treasuryEntry] = await Promise.all([
      await TokenModel.findOne({
        token_address: passedToken.token_address.toLowerCase(),
      }),

      await TreasuryModel.findOne({
        dao_name: passedToken.parent_dao.toLowerCase(),
      }),
    ]);

    if (!tokenEntry) throw new Error(`Token entry not found in database`);

    // Calculate assets under management
    let assetsUnderManagement: number | null = null;

    console.log(treasuryEntry);
    const totalTreasuryValue = Number(treasuryEntry?.total_treasury_value);
    const totalAssets = Number(treasuryEntry?.total_assets);

    if (!isNaN(totalTreasuryValue) && !isNaN(totalAssets)) {
      assetsUnderManagement = totalTreasuryValue + totalAssets;
    }

    // Structure the response data
    const response: TokenResponse = {
      name: passedToken.name,
      logo: passedToken.logo_url,
      assetsUnderManagement,
      selectedToken: {
        address: passedToken.token_address,
        chain_id: passedToken.chain_id,
        logoUrl: passedToken.logo_url,
        ticker: passedToken.mc_ticker,
        name: passedToken.name,
        parentDao: passedToken.parent_dao,
        networks: passedToken.networks,

        totalSupply: tokenEntry.total_supply,
        marketCap: tokenEntry.market_cap,
        averageBal: tokenEntry.average_balance,
        medianBal: tokenEntry.median_balance,
        totalHolders: tokenEntry.total_holders,
      },
      topHolders: tokenEntry.top_holders,
      tokenDistribution: tokenEntry.token_distribution,
    };

    res.json(response);
  } catch (err) {
    await logErrorEmbed(`Error within fetch token data function: ${err}`);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
    return;
  }
}
