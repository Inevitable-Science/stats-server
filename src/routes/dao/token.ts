import { Router, Request, Response } from "express";
import { daos, DAO, NativeToken, IPTEntry } from "../../config/constants";
import TreasuryModel, {
  TreasuryDocument,
} from "../../config/models/treasury_schema";
import TokenModel, { TokenDocument } from "../../config/models/token_schema";
import getTokenStats, {
  TokenStatsResponse,
} from "../../utils/fetch/token_stats";
import sendDiscordMessage from "../../utils/coms/send_message";

// Interface for the token response
interface TokenResponse {
  name: string;
  isIptToken: boolean;
  logo: string;
  tags: string;
  socials: {
    site: string | null;
    linked_in: string | null;
    x: string | null;
    discord: string | null;
  };
  assetsUnderManagement: number | null;
  selectedToken: {
    address: string | null;
    chain_id: number | null;
    logoUrl: string | null;
    ticker: string | null;
    tokenType: string | null;
    website: string | null;
    name: string | null;
    description: string | null;
    parentDao: string | null;
    networks: string[] | null;
    totalSupply: number | null;
    marketCap: number | null;
    averageBal: number | null;
    medianBal: number | null;
    totalHolders: string | null;
  };
  topHolders: Array<{
    address: string | null;
    token_amount: number | null;
    account_type: string | null;
  }> | null;
  tokenDistribution: Array<{
    range: string | null;
    accounts: string | null;
    amount_tokens_held: number | null;
    percent_tokens_held: number | null;
  }> | null;
}

let isRunning = false;

const router = Router();

router.get("/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ error: "Missing required parameter: token" });
      return;
    }

    let isIptToken = false;

    // Find the DAO that matches the token
    const foundDao = daos.find((d: DAO) => {
      // Check if the token matches native_token.name
      if (d.native_token.name.toLowerCase() === token.toLowerCase()) {
        return true;
      }

      // Check if any IPT object has the token name and is of type ERC-20
      if (d.ipt) {
        return Object.keys(d.ipt).some((key) => {
          if (
            d.ipt![key].name.toLowerCase() === token.toLowerCase() &&
            d.ipt![key].token_type === "ERC-20"
          ) {
            isIptToken = true; // Set to true if IPT token is found
            return true;
          }
          return false;
        });
      }

      return false;
    });

    if (!foundDao) {
      res.status(404).json({ error: "Token not found in any DAO" });
      return;
    }

    // Determine token stats from either native_token or ipt
    let tokenStats: NativeToken | IPTEntry = foundDao.native_token; // Default to native_token

    if (foundDao.ipt && isIptToken) {
      const iptToken = Object.keys(foundDao.ipt).find(
        (key) => foundDao.ipt![key].name.toLowerCase() === token.toLowerCase()
      );
      if (iptToken) {
        tokenStats = foundDao.ipt[iptToken];
      }
    }

    // Fetch token data from database
    const tokenAddress = tokenStats.token_address;
    const tokenEntry: TokenDocument | null = await TokenModel.findOne({
      token_address: tokenAddress,
    });

    // Fetch treasury data
    const daoName = foundDao.name.toLowerCase();
    const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({
      dao_name: daoName,
    });

    // Calculate assets under management
    let assetsUnderManagement: number | null = null;
    if (treasuryEntry?.total_treasury_value && treasuryEntry?.total_assets) {
      const totalTreasuryValue =
        parseFloat(treasuryEntry.total_treasury_value) || 0;
      const totalAssets = parseFloat(treasuryEntry.total_assets) || 0;
      assetsUnderManagement = totalTreasuryValue + totalAssets;
    }

    // Structure the response data
    const response: TokenResponse = {
      name: foundDao.name,
      isIptToken,
      logo: foundDao.logo_url,
      tags: foundDao.tag,
      socials: {
        site: foundDao.socials?.site || null,
        linked_in: foundDao.socials?.linked_in || null,
        x: foundDao.socials?.x || null,
        discord: foundDao.socials?.discord || null,
      },
      assetsUnderManagement,
      selectedToken: {
        address: tokenStats?.token_address || null,
        chain_id: tokenStats?.chain_id || null,
        logoUrl: tokenStats?.logo_url || null,
        ticker: tokenStats?.mc_ticker || null,
        tokenType:
          "token_type" in tokenStats ? tokenStats.token_type || null : null,
        website: "website" in tokenStats ? tokenStats.website || null : null,
        name: tokenStats?.name || null,
        description:
          "description" in tokenStats ? tokenStats.description || null : null,
        parentDao: tokenStats?.parent_dao || null,
        networks: tokenStats?.networks || null,
        totalSupply: tokenEntry?.total_supply || null,
        marketCap: tokenEntry?.market_cap || null,
        averageBal: tokenEntry?.average_balance || null,
        medianBal: tokenEntry?.median_balance || null,
        totalHolders: tokenEntry?.total_holders || null,
      },
      topHolders:
        tokenEntry?.top_holders?.map((holder) => ({
          address: holder.address || null,
          token_amount: holder.token_amount || null,
          account_type: holder.account_type || null,
        })) || null,
      tokenDistribution:
        tokenEntry?.token_distribution?.map((dist) => ({
          range: dist.range || null,
          accounts: dist.accounts || null,
          amount_tokens_held: dist.amount_tokens_held || null,
          percent_tokens_held: dist.percent_tokens_held || null,
        })) || null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching token data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// curl -X POST http://localhost:3001/token/refresh/cryo

router.post(
  "/refresh/:token",
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;

    if (!token) {
      res.status(400).json({ error: "Missing required parameter: token" });
      return;
    }

    if (isRunning) {
      await sendDiscordMessage(
        `**REJECTED request to refresh token stats for ${token} at ${new Date().toLocaleString()}: Function already running**`
      );
      res.status(429).json({ error: "We are already fetching new data." });
      return;
    }

    // Find the DAO that matches the token
    const foundDao = daos.find((d: DAO) => {
      if (d.native_token.name.toLowerCase() === token.toLowerCase()) {
        return true;
      }

      if (d.ipt) {
        return Object.keys(d.ipt).some(
          (key) =>
            d.ipt![key].name.toLowerCase() === token.toLowerCase() &&
            d.ipt![key].token_type === "ERC-20"
        );
      }

      return false;
    });

    if (!foundDao) {
      res.status(404).json({ error: "Token not found in any DAO" });
      return;
    }

    // Determine token stats from either native_token or ipt
    let tokenName = foundDao.native_token.name.toLowerCase();
    let tokenStats: NativeToken | IPTEntry = foundDao.native_token;

    if (foundDao.ipt) {
      const iptToken = Object.keys(foundDao.ipt).find(
        (key) => foundDao.ipt![key].name.toLowerCase() === token.toLowerCase()
      );
      if (iptToken) {
        tokenName = foundDao.ipt[iptToken].name.toLowerCase();
        tokenStats = foundDao.ipt[iptToken];
      }
    }

    if (!tokenStats.networks.includes("eth")) {
      res
        .status(400)
        .json({
          error: "Token must be on the Ethereum network to refresh stats.",
        });
      return;
    }

    const tokenAddress = tokenStats.token_address;
    const date = new Date();

    try {
      const tokenEntry: TokenDocument | null = await TokenModel.findOne({
        token_address: tokenAddress,
      });

      if (tokenEntry) {
        const lastUpdated = tokenEntry.last_updated;
        const timeDifference =
          (date.getTime() - lastUpdated.getTime()) / 1000 / 60;
        if (timeDifference < 15) {
          await sendDiscordMessage(
            `**REJECTED request to refresh token stats for ${tokenName} at ${new Date().toLocaleString()}: 15 minute grace period**`
          );
          res
            .status(400)
            .json({
              error:
                "Please wait 15 minutes before requesting a data update again.",
            });
          return;
        }
      }

      await sendDiscordMessage(
        `**Request to refresh token stats for ${tokenName} at ${new Date().toLocaleString()}**`
      );
      res.status(202).json({ message: "Processing request in the background" });

      // Set isRunning to true and process in the background
      isRunning = true;
      setImmediate(async () => {
        try {
          // Fetch token stats
          const tokenStatsResult: TokenStatsResponse | null =
            await getTokenStats(
              tokenStats.mc_ticker,
              tokenStats.token_address,
              tokenStats.token_abi,
              tokenStats.creation_block,
              tokenStats.decimals
            );

          if (tokenStatsResult === null) {
            await sendDiscordMessage(
              `**FAILED TO REFRESH TOKEN STATS FOR ${tokenName} @ ${new Date().toLocaleString()}**`
            );
            return;
          }

          const currentDate = new Date();
          currentDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00

          // Get the current timestamp
          const currentTimestamp = Number(currentDate.getTime());
          const currentHolderCount = Number(
            tokenStatsResult.stats.totalWallets
          ); // Default to 0 if no data

          const convertedTopHolders = (
            tokenStatsResult?.tokenStats?.topHolders || []
          ).map((item) => ({
            address: item?.address || null,
            token_amount: item?.balance || null,
            account_type: item?.type || null,
          }));

          const convertedDistribution = (
            tokenStatsResult?.stats?.groupStats || []
          ).map((item) => ({
            range: item?.percentage || null,
            accounts: item?.walletsCount || null,
            amount_tokens_held: item?.cumulativeBalance || null,
            percent_tokens_held: item?.walletsHoldingPercentage || null,
          }));

          if (!tokenEntry) {
            const newEntry = new TokenModel({
              token_name: tokenStats.name.toLowerCase(),
              token_address: tokenStats.token_address,
              date_added: date,
              last_updated: date,
              total_supply: tokenStatsResult.tokenStats.totalSupply,
              market_cap: tokenStatsResult.tokenStats.marketCap,
              average_balance: tokenStatsResult.stats.averageBalance,
              median_balance: tokenStatsResult.stats.medianBalance,
              total_holders: tokenStatsResult.stats.totalWallets,
              top_holders: convertedTopHolders,
              token_distribution: convertedDistribution,
              holders_graph: [[currentTimestamp, currentHolderCount]],
            });

            await newEntry.save();
            await sendDiscordMessage(
              `**Completed refreshing token stats for ${tokenName} at ${new Date().toLocaleString()}**`
            );
          } else {
            const updatedEntry = {
              token_name: tokenEntry.token_name,
              token_address: tokenEntry.token_address,
              date_added: tokenEntry.date_added,
              last_updated: date,
              total_supply: tokenStatsResult.tokenStats.totalSupply,
              market_cap: tokenStatsResult.tokenStats.marketCap,
              average_balance: tokenStatsResult.stats.averageBalance,
              median_balance: tokenStatsResult.stats.medianBalance,
              total_holders: tokenStatsResult.stats.totalWallets,
              top_holders: convertedTopHolders,
              token_distribution: convertedDistribution,
              holders_graph: tokenEntry.holders_graph,
            };

            await TokenModel.updateOne(
              { token_address: tokenEntry.token_address },
              { $set: updatedEntry }
            );
            await sendDiscordMessage(
              `**Completed refreshing token stats for ${tokenName} at ${new Date().toLocaleString()}**`
            );
          }
        } catch (error) {
          await sendDiscordMessage(
            `**FAILED TO REFRESH TOKEN STATS FOR ${tokenName} @ ${new Date().toLocaleString()}**`
          );
          console.error(`Error refreshing token ${tokenStats.name}:`, error);
        } finally {
          isRunning = false;
        }
      });
    } catch (error) {
      console.error("Error initiating token refresh:", error);
      isRunning = false;
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
