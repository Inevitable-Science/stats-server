// src/utils/cron/token_refresh.ts
import TokenModel, { TokenDocument } from "../../../config/models/tokenSchema";
import { daos } from "../../../config/constants";
import getTokenStats, {
  TokenStatsResponse,
} from "../../fetch/token/tokenStats";
import { Address } from "viem";
import logAction, { logErrorEmbed } from "../../coms/logAction";
import { generateDiscordTimestamp } from "../../utils";

async function fetchAndUpdateAllTokenStats(): Promise<void> {
  try {
    await logAction({
      action: "logAction",
      message: `**Starting daily token refresh ${generateDiscordTimestamp(new Date(), "R")}**`
    });

    const tokens = daos.map(dao => {
      return {
        token_name: dao.native_token.name,
        token_address: dao.native_token.token_address.toLowerCase(),
      }
    })

    //tokens.length = 1; // rm later on for testing atm

    for (const token of tokens) {
      try {
        const foundDao = daos.find(d => d.native_token.token_address.toLocaleLowerCase() === token.token_address);
        if (!foundDao) continue;

        const entry: TokenDocument | null = await TokenModel.findOne({
          token_address: token.token_address,
        });

        await logAction({
          action: "logAction",
          message: `**Refreshing Token Stats For: ${token.token_name} at ${generateDiscordTimestamp(new Date(), "R")}**`
        });
        console.log("Refreshing Stats For:", token.token_name);

        const date = new Date();
        if (entry) {
          // difference in ms -> sec -> min
          const timeDifference = (date.getTime() - entry.last_updated.getTime()) / 1000 / 60; 
          if (timeDifference < 15) {
            await logAction({
              action: "logAction",
              message: `**Skipping ${token.token_name}, update requested too soon. (last updated <15 minutes ago)**`
            });
            continue;
          }
        }

        const tokenStats: TokenStatsResponse | null = await getTokenStats(
          foundDao.native_token.mc_ticker,
          token.token_address.toLowerCase() as Address,
          foundDao.native_token.creation_block,
        );

        if (!tokenStats) {
          throw new Error("No token stats returned");
        }

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00
        const currentTimestamp = currentDate.getTime();

        // Push the new data to holders_graph
        const updatedHoldersGraph = entry ? [
          ...entry.holders_graph,
          [currentTimestamp, tokenStats.totalHolders],
        ] : [
          [currentTimestamp, tokenStats.totalHolders]
        ];

        const updatedEntry = {
          token_name: token.token_name,
          token_address: token.token_address.toLowerCase(),
          date_added: entry ? entry.date_added : new Date(),
          last_updated: date,

          total_supply: tokenStats.totalSupply,
          market_cap: tokenStats.marketCap,
          total_holders: tokenStats.totalHolders.toString() || null,
          average_balance: tokenStats.averageBalance || null,
          median_balance: tokenStats.medianBalance || null,
          top_holders: tokenStats.topHolders,
          token_distribution: tokenStats.groupStats,
          holders_graph: updatedHoldersGraph,
        };

        await TokenModel.updateOne(
          { token_address: token.token_address },
          { $set: updatedEntry },
          { upsert: true }
        );

        await logAction({
          action: "logAction",
          message: `**Finished refreshing ${token.token_name} token stats**`
        });

      } catch (err) {
        await logErrorEmbed(`Error occurred refreshing token: ${token.token_name}`);
        continue;
      }
    }
  } catch (error) {
    await logErrorEmbed(`**AN ERROR OCCURRED REFRESHING ALL TOKEN STATS, child of daily refresh function**`);
  } finally {
    await logAction({
      action: "logAction",
      message: `**Daily token refresh complete at ${generateDiscordTimestamp(new Date(), "R")}**`
    });
  }
}

export default fetchAndUpdateAllTokenStats;
