import { ErrorCodes } from "../../utils/errors";
import { logErrorEmbed } from "../../utils/coms/logAction";
import { Request, Response } from "express";
import TokenModel from "../../config/models/tokenSchema";
import FollowersModel from "../../config/models/followersSchema";

// Token Marketcap
// Total Project Funding
// Ecosystem Token Holders
// Community Size

export async function ecosystemHandler(req: Request, res: Response): Promise<void> {
  try {
    
    const tokenAddress = "0xaF04f0912E793620824F4442b03F4d984Af29853";
    const marketCapQuery = await TokenModel.findOne({ token_address: tokenAddress.toLowerCase() });
    let tokenMarketCap: number | null = null;
    if (marketCapQuery) {
      tokenMarketCap = marketCapQuery.market_cap;
    };
    const totalProjectFunding = 0;

    const holdersQuery = await TokenModel.aggregate([
      {
        $group: {
          _id: null,
          holders: {
            $sum: { $toLong: "$total_holders" }
          }
        }
      }
    ]);
    const holders = holdersQuery[0]?.holders ?? 0;

    const followersQuery = await FollowersModel.aggregate([
      {
        $group: {
          _id: null,
          totalFollowers: { $sum: "$current_followers" }
        }
      }
    ]);
    const followersCount = followersQuery[0]?.totalFollowers ?? 0;

    res.status(200).json({
      marketCap: tokenMarketCap,
      projectFunding: totalProjectFunding,
      tokenHolders: holders,
      communitySize: followersCount
    });
    return;
  } catch (err) {
    await logErrorEmbed(`Error within fetch token data function: ${err}`);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
    return;
  }
}