// src/utils/cron/treasury_refresh.ts
import TreasuryModel, {
  TreasuryDocument,
} from "../../../config/models/treasurySchema";
import { daos } from "../../../config/constants";
import getAssetsManaged from "../../fetch/treasury/assetsManaged";
import getTreasuryHoldings, {
  TreasuryHoldings,
  WalletData,
} from "../../fetch/treasury/treasuryHoldings";
import sendDiscordMessage from "../../../utils/coms/send_message";


async function fetchAndUpdateTreasuries(): Promise<void> {
  try {
    const date = new Date();

    await sendDiscordMessage(
      `**Starting daily treasury refresh at: ${new Date().toLocaleString()}**`
    );

    // Iterate through all DAOs
    for (const foundDao of daos) {
      await sendDiscordMessage(
        `**Refreshing Treasury Stats For: ${foundDao.name} at ${new Date().toLocaleString()}**`
      );

      const entry = await TreasuryModel.findOne({
        dao_name: foundDao.name.toLowerCase(),
      });

      if (entry) { // uncomment in prod
        const timeDifference = (date.getTime() - entry.last_updated.getTime()) / 1000 / 60;
        if (timeDifference < 15) {
          await sendDiscordMessage(
            `**Skipping ${foundDao.name}, update requested too soon. (last updated <15 minutes ago)**`
          );
          console.log(`Skipping ${foundDao.name}, update requested too soon.`);
          continue;
        }
      }

      // Start background processing
      try {
        const managedAccounts = foundDao.managed_accounts.map(acc => acc.address);
        const mappedChainId = foundDao.managed_accounts.map(acc => acc.chain_id);
        const chainIds = Array.from(new Set(mappedChainId));

        // Fetch assets and treasury holdings, use fallback if unavailable
        const [assetsManaged, treasuryHoldings]: [number, TreasuryHoldings] =
          await Promise.all([
            getAssetsManaged(managedAccounts, chainIds),
            getTreasuryHoldings(foundDao.treasury.address, foundDao.treasury.chain_id),
          ]);

        console.log(assetsManaged, "ASSETS");
        console.log(treasuryHoldings, "TREASURY");

        // Ensure we have valid data
        const usdBalance = Number(treasuryHoldings.usdBalance) || 0;
        const tokens = treasuryHoldings.tokens || [];
        console.log(treasuryHoldings, "treasury holdings");

        // Check if this DAO already has a treasury entry
        if (!entry) {
          // If no entry, create a new treasury record
          const newEntry = new TreasuryModel({
            dao_name: foundDao.name.toLowerCase(),
            date_added: date,
            last_updated: date,
            total_treasury_value: String(usdBalance),
            total_assets: String(assetsManaged),
            tokens: tokens.map((token: WalletData) => ({
              contractAddress: token.contractAddress || "0x0",
              metadata: {
                name: token.metadata?.name || "Unknown",
                symbol: token.metadata?.symbol || "UNKNOWN",
                decimals: token.metadata?.decimals || 18,
              },
              rawBalance: token.rawBalance || "0",
              decodedBalance: Number(token.decodedBalance) || 0,
              price: Number(token.price) || 0,
              totalValue: Number(token.totalValue) || 0,
            })),
            historical_treasury: [
              {
                date,
                balance: String(usdBalance),
                assets: String(assetsManaged),
              },
            ],
          });

          await newEntry.save();
          console.log(`Created new treasury entry for ${foundDao.name}`);
        } else {
          // If entry exists, update the treasury record
          const updatedEntry: Partial<TreasuryDocument> = {
            dao_name: entry.dao_name,
            date_added: entry.date_added,
            last_updated: date,
            total_treasury_value: String(usdBalance),
            total_assets: String(assetsManaged),
            tokens: tokens.map((token: WalletData) => ({
              contractAddress: token.contractAddress || "0x0",
              metadata: {
                name: token.metadata?.name || "Unknown",
                symbol: token.metadata?.symbol || "UNKNOWN",
                decimals: token.metadata?.decimals || 18,
              },
              rawBalance: token.rawBalance || "0",
              decodedBalance: Number(token.decodedBalance) || 0,
              price: Number(token.price) || 0,
              totalValue: Number(token.totalValue) || 0,
            })),
            historical_treasury: [
              ...entry.historical_treasury,
              {
                date,
                balance: String(usdBalance),
                assets: String(assetsManaged),
              },
            ],
          };

          await TreasuryModel.updateOne(
            { dao_name: entry.dao_name },
            { $set: updatedEntry }
          );
          console.log(`Updated treasury entry for ${foundDao.name}`);
          await sendDiscordMessage(
            `**Finished refreshing ${entry.dao_name} treasury stats**`
          );
        }
      } catch (err) {
        await sendDiscordMessage(
          `Error occurred refreshing treasury: ${foundDao.name}`
        );
        console.error(
          `Error occurred while refreshing treasury for ${foundDao.name}:`,
          err
        );
      }
    }
  } catch (err) {
    await sendDiscordMessage(
      `**AN ERROR OCCURRED REFRESHING ALL TREASURY STATS**`
    );
    console.error("Error occurred while refreshing treasuries:", err);
  } finally {
    await sendDiscordMessage(
      `**Daily treasury refresh complete at ${new Date().toLocaleString()}**`
    );
    console.log("DAILY TREASURY REFRESH COMPLETED");
  }
}

export default fetchAndUpdateTreasuries;
