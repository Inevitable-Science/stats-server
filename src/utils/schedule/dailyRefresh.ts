import fetchAndUpdateTokenStats from "./handlers/token_refresh";
import fetchAndUpdateTreasuries from "./handlers/treasuryRefresh";
import fetchAndUpdateTwitterFollowers from "./handlers/twitterRefresh";
import logAction, { logErrorEmbed } from "../coms/logAction";

async function dailyRefresh() {
  try {
    await logAction({
      action: "logAction",
      message: "**Started Daily Stats Refresh**"
    });

    await fetchAndUpdateTokenStats();
    await logAction({
      action: "logAction",
      message: "**Daily Token Stats Refresh Completed**"
    });

    //await fetchAndUpdateTreasuries();

    //await fetchAndUpdateTwitterFollowers();

    await logAction({
      action: "logAction",
      message: "**Daily Stats Refresh Completed**"
    });
  } catch (err) {
    console.error("Error refreshing daily stats", err);
    await logErrorEmbed(`Error in parent daily refresh stats function **BREAKING:** ${err}`);
  }
}

export default dailyRefresh;
