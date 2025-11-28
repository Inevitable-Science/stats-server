// src/utils/cron/token_refresh.ts
import TokenModel, { TokenDocument } from "../../../config/models/token_schema";
import { daos, DAO, NativeToken, IPTEntry } from "../../../config/constants";
import getTokenStats, {
  TokenStatsResponse,
} from "../../../utils/fetch/token_stats";
import sendDiscordMessage from "../../../utils/coms/send_message";

async function fetchAndUpdateTokenStats(): Promise<void> {
  try {
    await sendDiscordMessage(
      `**Starting daily token refresh at: ${new Date().toLocaleString()}**`
    );
    const tokens: TokenDocument[] = await TokenModel.find();

    for (const tokenStats of tokens) {
      const tokenAddress = tokenStats.token_address;
      const entry: TokenDocument | null = await TokenModel.findOne({
        token_address: tokenAddress,
      });
      if (!entry) continue;

      await sendDiscordMessage(
        `**Refreshing Token Stats For: ${entry.token_name} at ${new Date().toLocaleString()}**`
      );
      console.log("Refreshing Stats For:", entry.token_name);
      const date = new Date();

      const foundDao = daos.find((d: DAO) => {
        // Check if the token matches native_token.token_address
        if (
          d.native_token.token_address.toLowerCase() ===
          tokenAddress.toLowerCase()
        ) {
          return true;
        }

        // Check if any IPT object has the token address and is of type ERC-20
        if (d.ipt) {
          return Object.keys(d.ipt).some(
            (key) =>
              d.ipt![key].token_address.toLowerCase() ===
                tokenAddress.toLowerCase() &&
              d.ipt![key].token_type === "ERC-20"
          );
        }

        return false;
      });

      if (!foundDao) continue;

      const lastUpdated = entry.last_updated;
      const timeDifference =
        (date.getTime() - lastUpdated.getTime()) / 1000 / 60;
      if (timeDifference < 15) {
        await sendDiscordMessage(
          `**Skipping ${foundDao.name}, update requested too soon. (last updated <15 minutes ago)**`
        );
        console.log(
          "Please wait 15 minutes before requesting a data update again."
        );
        continue;
      }

      let tokenName = foundDao.native_token.name.toLowerCase();
      let hardcodedStats: NativeToken | IPTEntry = foundDao.native_token; // Default to native_token

      if (foundDao.ipt) {
        const iptToken = Object.keys(foundDao.ipt).find(
          (key) =>
            foundDao.ipt![key].token_address.toLowerCase() ===
            tokenAddress.toLowerCase()
        );
        if (iptToken) {
          tokenName = foundDao.ipt[iptToken].name.toLowerCase();
          hardcodedStats = foundDao.ipt[iptToken];
        }
      }

      if (
        hardcodedStats.token_address.toLowerCase() !==
        tokenAddress.toLowerCase()
      )
        continue;

      try {
        const tokenStatsFunc: TokenStatsResponse | null = await getTokenStats(
          hardcodedStats.mc_ticker,
          tokenAddress,
          hardcodedStats.token_abi,
          hardcodedStats.creation_block,
          hardcodedStats.decimals
        );

        if (!tokenStatsFunc) {
          throw new Error("No token stats returned");
        }

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set the time to 00:00:00

        // Get the current timestamp
        const currentTimestamp = Number(currentDate.getTime());
        const currentHolderCount = Number(tokenStatsFunc.stats.totalWallets); // Default to 0 if no data

        // Push the new data to holders_graph
        const updatedHoldersGraph = [
          ...entry.holders_graph,
          [currentTimestamp, currentHolderCount],
        ];

        const convertedTopHolders = (
          tokenStatsFunc.tokenStats.topHolders || []
        ).map((item) => ({
          address: item?.address || null,
          token_amount: item?.balance || null,
          account_type: item?.type || null,
        }));

        const convertedDistribution = (
          tokenStatsFunc.stats.groupStats || []
        ).map((item) => ({
          range: item?.percentage || null,
          accounts: item?.walletsCount?.toString() || null,
          amount_tokens_held: item?.cumulativeBalance
            ? Number(item.cumulativeBalance) || null
            : null,
          percent_tokens_held: item?.walletsHoldingPercentage || null,
        }));

        const updatedEntry = {
          token_name: entry.token_name,
          token_address: entry.token_address,
          date_added: entry.date_added,
          last_updated: date,
          total_supply: tokenStatsFunc.tokenStats.totalSupply,
          market_cap: tokenStatsFunc.tokenStats.marketCap,
          average_balance: Number(tokenStatsFunc.stats.averageBalance) || null,
          median_balance: Number(tokenStatsFunc.stats.medianBalance) || null,
          total_holders: tokenStatsFunc.stats.totalWallets.toString() || null,
          top_holders: convertedTopHolders,
          token_distribution: convertedDistribution,
          // holders_graph: entry.holders_graph,
          holders_graph: updatedHoldersGraph,
        };

        await TokenModel.updateOne(
          { token_address: entry.token_address },
          { $set: updatedEntry }
        );
        console.log("Refreshed Stats For:", entry.token_name);
        await sendDiscordMessage(
          `**Finished refreshing ${entry.token_name} token stats**`
        );
      } catch (err) {
        await sendDiscordMessage(
          `Error occurred refreshing token: ${entry.token_name}`
        );
        console.error(
          `Error occurred refreshing token ${entry.token_name}:`,
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
