import fetchAndUpdateTokenStats from "./handlers/token_refresh";
import fetchAndUpdateTreasuries from "./handlers/treasury_refresh";
import sendDiscordMessage from "../coms/send_message";
import fetchAndUpdateTwitterFollowers from "./handlers/twitter_refresh";

async function dailyRefresh() {
  try {
    await sendDiscordMessage("**Started Daily Stats Refresh**");
    await fetchAndUpdateTokenStats();

    await sendDiscordMessage("**Daily Token Stats Refresh Completed**");
    await fetchAndUpdateTreasuries();

    await sendDiscordMessage("**Daily Treasury Stats Refresh Completed**");
    await fetchAndUpdateTwitterFollowers();

    await sendDiscordMessage("**Daily Stats Refresh Completed**");
  } catch (error) {
    console.log("Error refreshing daily stats", error);
    await sendDiscordMessage("Error during daily stats refresh");
  }
}

export default dailyRefresh;
