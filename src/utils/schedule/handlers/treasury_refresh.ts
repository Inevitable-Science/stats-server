// src/utils/cron/treasury_refresh.ts
import TreasuryModel, {
  TreasuryDocument,
} from "../../../config/models/treasury_schema";
import { daos } from "../../../config/constants";
import getAssetsManaged from "../../../utils/fetch/assets_managed";
import getTreasuryHoldings, {
  TreasuryHoldings,
  WalletData,
} from "../../../utils/fetch/treasury_holdings";
import sendDiscordMessage from "../../../utils/coms/send_message";

// Interface for wallet data (from assets_managed.ts)
interface AssetsManagedWalletData {
  [address: string]: {
    chain: "eth" | "sol" | "base" | "poly" | "btc" | "arb";
  };
}

// Helper function to sanitize DAO name
function sanitizeName(name: string): string | null {
  return /^[a-zA-Z0-9]+$/.test(name) ? name : null;
}

async function fetchAndUpdateTreasuries(): Promise<void> {
  const date = new Date();

  try {
    await sendDiscordMessage(
      `**Starting daily treasury refresh at: ${new Date().toLocaleString()}**`
    );

    // Iterate through all DAOs
    for (const foundDao of daos) {
      const sanitizedNameUppercase = sanitizeName(foundDao.name);
      const sanitizedName = sanitizedNameUppercase
        ? sanitizedNameUppercase.toLowerCase()
        : null;

      if (!sanitizedName) {
        console.log("Invalid DAO name format.");
        await sendDiscordMessage(
          `**Skipping ${foundDao.name}: Invalid DAO name format**`
        );
        continue;
      }

      await sendDiscordMessage(
        `**Refreshing Treasury Stats For: ${sanitizedNameUppercase} at ${new Date().toLocaleString()}**`
      );

      const entry: TreasuryDocument | null = await TreasuryModel.findOne({
        dao_name: sanitizedName,
      });

      if (entry) {
        const lastUpdated = entry.last_updated;
        const timeDifference =
          (date.getTime() - lastUpdated.getTime()) / 1000 / 60;
        if (timeDifference < 15) {
          await sendDiscordMessage(
            `**Skipping ${foundDao.name}, update requested too soon. (last updated <15 minutes ago)**`
          );
          console.log(`Skipping ${foundDao.name}, update requested too soon.`);
          continue;
        }
      } /*else {
        continue; // Skip if no entry exists
      }*/

      // Start background processing
      try {
        // Transform managed_accounts to AssetsManagedWalletData
        const walletData: AssetsManagedWalletData = Object.keys(
          foundDao.managed_accounts
        ).reduce((acc, address) => {
          const chain = foundDao.managed_accounts[address].chain as
            | "eth"
            | "sol"
            | "base"
            | "poly"
            | "btc"
            | "arb";
          acc[address] = { chain };
          return acc;
        }, {} as AssetsManagedWalletData);

        // Fetch assets and treasury holdings, use fallback if unavailable
        const [assetsManaged, treasuryHoldings]: [number, TreasuryHoldings] =
          await Promise.all([
            getAssetsManaged(walletData).catch(() => 0), // Fallback to 0 if API fails
            getTreasuryHoldings(foundDao.treasury.address).catch(() => ({
              usdBalance: "0.00",
              tokens: [],
            })), // Fallback to empty data
          ]);

        console.log(assetsManaged, "ASSETS");
        console.log(treasuryHoldings, "TREASURY");

        // Ensure we have valid data
        const usdBalance = Number(treasuryHoldings.usdBalance) || 0;
        const tokens = treasuryHoldings.tokens || [];

        // Check if this DAO already has a treasury entry
        if (!entry) {
          // If no entry, create a new treasury record
          const newEntry = new TreasuryModel({
            dao_name: sanitizedName,
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
          console.log(`Created new treasury entry for ${sanitizedName}`);
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
          console.log(`Updated treasury entry for ${sanitizedName}`);
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
