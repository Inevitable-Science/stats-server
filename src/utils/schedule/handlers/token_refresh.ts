// src/utils/cron/token_refresh.ts
import TokenModel, { TokenDocument } from "../../../config/models/tokenSchema";
import { daos, DAO, NativeToken, IPTEntry } from "../../../config/constants";
import getTokenStats, {
  TokenStatsResponse,
} from "../../fetch/token/tokenStats";
import sendDiscordMessage from "../../../utils/coms/send_message";
import { Address } from "viem";

async function fetchAndUpdateTokenStats(): Promise<void> {
  try {
    await sendDiscordMessage(
      `**Starting daily token refresh at: ${new Date().toLocaleString()}**`
    );
    //const tokens: TokenDocument[] = await TokenModel.find();
    const tokens = daos.map(dao => {
      return {
        token_name: dao.native_token.name,
        token_address: dao.native_token.token_address.toLowerCase(),
      }
    })

    tokens.length = 1; // rm later on for testing atm

    for (const token of tokens) {
      const foundDao = daos.find(d => d.native_token.token_address.toLocaleLowerCase() === token.token_address);
      if (!foundDao) continue;

      const entry: TokenDocument | null = await TokenModel.findOne({
        token_address: token.token_address,
      });

      await sendDiscordMessage(
        `**Refreshing Token Stats For: ${token.token_name} at ${new Date().toLocaleString()}**`
      );

      console.log("Refreshing Stats For:", token.token_name);
      const date = new Date();

      /*if (entry) {
        const lastUpdated = entry.last_updated;
        const timeDifference =
          (date.getTime() - lastUpdated.getTime()) / 1000 / 60;
        if (timeDifference < 15) {
          await sendDiscordMessage(
            `**Skipping ${token.token_name}, update requested too soon. (last updated <15 minutes ago)**`
          );
          console.log(
            "Please wait 15 minutes before requesting a data update again."
          );
          continue;
        }
      }*/

      let hardcodedStats: NativeToken = foundDao.native_token;
      try {

        const tokenStats: TokenStatsResponse | null = await getTokenStats(
          hardcodedStats.mc_ticker,
          token.token_address.toLowerCase() as Address,
          hardcodedStats.creation_block,
        );

        if (!tokenStats) {
          throw new Error("No token stats returned");
        }

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00

        // Get the current timestamp
        const currentTimestamp = currentDate.getTime();
        const currentHolderCount = tokenStats.totalHolders; // Default to 0 if no data

        // Push the new data to holders_graph
        const updatedHoldersGraph = entry ? [
          ...entry.holders_graph,
          [currentTimestamp, currentHolderCount],
        ] : [
          [currentTimestamp, currentHolderCount]
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
          { token_address: token.token_address }, // query
          { $set: updatedEntry },                 // update fields
          { upsert: true }                        // create if not found
        );
        console.log("Refreshed Stats For:", token.token_name);
        await sendDiscordMessage(
          `**Finished refreshing ${token.token_name} token stats**`
        );
      } catch (err) {
        await sendDiscordMessage(
          `Error occurred refreshing token: ${token.token_name}`
        );
        console.error(
          `Error occurred refreshing token ${token.token_name}:`,
          err
        );
      }
    }
  } catch (error) {
    await sendDiscordMessage(
      `**AN ERROR OCCURRED REFRESHING ALL TOKEN STATS**`
    );
    console.error("Error fetching data:", error);
  } finally {
    await sendDiscordMessage(
      `**Daily token refresh complete at ${new Date().toLocaleString()}**`
    );
    console.log("DAILY TOKEN REFRESH COMPLETED");
  }
}

export default fetchAndUpdateTokenStats;
