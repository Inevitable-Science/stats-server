import { daos } from "../../../config/constants";
import TokenModel, { TokenDocument } from "../../../config/models/tokenSchema";
import logAction, { logErrorEmbed } from "../../../utils/coms/logAction";
import { ErrorCodes } from "../../../utils/errors";
import getTokenStats from "../../../utils/fetch/token/tokenStats";
import { generateDiscordTimestamp } from "../../../utils/utils";
import { Request, Response } from "express";
import z from "zod";

let isRunning: boolean;

export async function refreshTokenStats(req: Request, res: Response): Promise<void> {
  try {
    const { tokenName } = req.params;
    const parsedToken = z.string().nonempty().parse(tokenName.toLowerCase());

    if (isRunning) {
      await logAction({
        action: "logAction",
        message: `**REJECTED request to refresh token stats for ${parsedToken} ${generateDiscordTimestamp(new Date(), "R")}: Function already running**`
      });

      res.status(409).json({ error: ErrorCodes.JOB_ALREADY_RUNNING });
      return;
    }

    const foundDao = daos.find(dao => dao.native_token.name.toLowerCase() === parsedToken);
    if (!foundDao) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    };

    // Determine token stats from either native_token or ipt
    const nativeToken = foundDao.native_token;

    if (!nativeToken.networks.includes("eth")) { // review this allow for omnichain tokens
      res.status(400).json({
        error: "Token must be on the Ethereum network to refresh stats.",
      });
      return;
    }

    const date = new Date();
    const tokenEntry = await TokenModel.findOne({
      token_address: nativeToken.token_address.toLowerCase(),
    });

    if (tokenEntry) {
      const lastUpdated = tokenEntry.last_updated;
      const timeDifference = (date.getTime() - lastUpdated.getTime()) / 1000 / 60;

      if (timeDifference < 15) {
        await logAction({
          action: "logAction",
          message: `**REJECTED request to refresh token stats for ${tokenName} ${generateDiscordTimestamp(new Date(), "R")}: 15 minute grace period**`
        });
        res.status(429).json({
          error:
            ErrorCodes.GRACE_PERIOD,
        });
        return;
      }
    }

    await logAction({
      action: "logAction",
      message: `**Request to refresh token stats for ${tokenName} ${generateDiscordTimestamp(new Date(), "R")}**`
    });
    res.status(202).json({ message: "Processing request in the background" });

    // Set isRunning to true and process in the background
    isRunning = true;
    setImmediate(async () => {
      try {
        // Fetch token stats
        const tokenStatsResult =
          await getTokenStats(
            nativeToken.mc_ticker,
            nativeToken.token_address,
            nativeToken.creation_block
          );

        console.log(tokenStatsResult);
        if (!tokenStatsResult) {
          await logErrorEmbed(`**FAILED TO REFRESH TOKEN STATS FOR ${tokenName} ${generateDiscordTimestamp(new Date(), "R")} - no response from function handler**`);
          return;
        }

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00
        const currentTimestamp = Number(currentDate.getTime());

        const holders_graph = tokenEntry?.holders_graph
          ? [
              ...tokenEntry.holders_graph.filter(([ts]) => ts !== currentTimestamp),
              [currentTimestamp, tokenStatsResult.totalHolders],
            ]
          : [[currentTimestamp, tokenStatsResult.totalHolders]];

        const constructedEntry = {
          token_name: nativeToken.name.toLowerCase(),
          token_address: nativeToken.token_address.toLowerCase(),
          date_added: date,
          last_updated: date,
          total_supply: tokenStatsResult.totalSupply,
          market_cap: tokenStatsResult.marketCap,
          average_balance: tokenStatsResult.averageBalance,
          median_balance: tokenStatsResult.medianBalance,
          total_holders: tokenStatsResult.totalHolders,
          top_holders: tokenStatsResult.topHolders,
          token_distribution: tokenStatsResult.groupStats,
          holders_graph,
        };

        console.log(constructedEntry);

        await TokenModel.updateOne(
          { token_address: nativeToken.token_address.toLowerCase() },
          { $set: constructedEntry },
          { upsert: true }
        );
        await logAction({
          action: "logAction",
          message: `**Completed refreshing token stats for ${tokenName} at ${generateDiscordTimestamp(new Date(), "R")}**`
        });

      } catch (err) {
        await logErrorEmbed(`**FAILED TO REFRESH TOKEN STATS FOR ${tokenName} ${generateDiscordTimestamp(new Date(), "R")} - ${err}**`);
      } finally {
        isRunning = false;
      }
    });
  } catch (err) {
    await logErrorEmbed(`Error initiating token refresh: ${err}`);
    isRunning = false;
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
    return;
  }
};
