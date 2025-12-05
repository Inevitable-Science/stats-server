import fetchAndUpdateTokenStats from "./handlers/tokenRefresh";
import fetchAndUpdateTreasuries from "./handlers/treasuryRefresh";
import fetchAndUpdateTwitterFollowers from "./handlers/twitterRefresh";
import logAction, { logErrorEmbed } from "../coms/logAction";

async function dailyRefresh() {
  try {
    await logAction({
      action: "logAction",
      message: "**Started Daily Stats Refresh**",
    });

    await fetchAndUpdateTokenStats();
    await fetchAndUpdateTreasuries();
    await fetchAndUpdateTwitterFollowers();

    await logAction({
      action: "logAction",
      message: "**Daily Stats Refresh Completed**",
    });
  } catch (err) {
    await logErrorEmbed(
      `Error in parent daily refresh stats function **BREAKING:** ${err}`
    );
  }
}

export default dailyRefresh;
