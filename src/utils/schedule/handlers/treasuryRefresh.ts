import TreasuryModel, {
  TreasuryDocumentSchemaZ,
  TreasuryDocumentType,
} from "../../../config/models/treasurySchema";
import { daos } from "../../../config/constants";
import getAssetsManaged from "../../fetch/treasury/assetsManaged";
import getTreasuryHoldings, {
  TreasuryHoldingsResponse,
} from "../../fetch/treasury/treasuryHoldings";
import logAction, { logErrorEmbed } from "../../coms/logAction";
import { generateDiscordTimestamp } from "../../utils";

async function fetchAndUpdateTreasuries(): Promise<void> {
  try {
    const date = new Date();

    await logAction({
      action: "logAction",
      message: `**Starting daily treasury refresh: ${generateDiscordTimestamp(new Date(), "R")}**`,
    });

    // Iterate through all DAOs
    for (const foundDao of daos) {
      try {
        await logAction({
          action: "logAction",
          message: `**Refreshing Treasury Stats For: ${foundDao.name} - ${generateDiscordTimestamp(new Date(), "R")}**`,
        });

        const entry = await TreasuryModel.findOne({
          dao_name: foundDao.name.toLowerCase(),
        });

        if (entry) {
          const timeDifference =
            (date.getTime() - entry.last_updated.getTime()) / 1000 / 60;
          if (timeDifference < 15) {
            await logAction({
              action: "logAction",
              message: `Skipping ${foundDao.name}, update requested too soon. (last updated ${generateDiscordTimestamp(entry.last_updated, "R")})`,
            });
            console.log(
              `Skipping ${foundDao.name}, update requested too soon.`
            );
            continue;
          }
        }

        // Start background processing
        const managedAccounts = foundDao.managed_accounts.map(
          (acc) => acc.address
        );
        const mappedChainId = foundDao.managed_accounts.map(
          (acc) => acc.chain_id
        );
        const chainIds = Array.from(new Set(mappedChainId));

        // Fetch assets and treasury holdings, use fallback if unavailable
        const [treasuryHoldings, assetsManaged]: [
          TreasuryHoldingsResponse,
          number,
        ] = await Promise.all([
          getTreasuryHoldings(
            foundDao.treasury.address,
            foundDao.treasury.chain_id
          ),
          getAssetsManaged(managedAccounts, chainIds),
        ]);

        if (!treasuryHoldings)
          throw new Error("No treasury holdings passed from handler function");
        console.log(treasuryHoldings, "treasury holdings");

        const treasuryData: TreasuryDocumentType = {
          dao_name: foundDao.name.toLowerCase(),
          date_added: entry ? entry.date_added : date,
          last_updated: new Date(),
          total_treasury_value: treasuryHoldings.usdBalance,
          total_assets: String(assetsManaged),
          tokens: treasuryHoldings.tokens.map((token) => ({
            contractAddress: token.contractAddress,
            metadata: {
              name: token.metadata.name,
              symbol: token.metadata.symbol,
              decimals: token.metadata.decimals,
            },
            rawBalance: token.rawBalance,
            decodedBalance: token.decodedBalance,
            price: token.price,
            totalValue: token.totalValue,
          })),
          historical_treasury: entry?.historical_treasury
            ? [
                ...entry.historical_treasury,
                {
                  date,
                  balance: treasuryHoldings.usdBalance,
                  assets: String(assetsManaged),
                },
              ]
            : [
                {
                  date,
                  balance: treasuryHoldings.usdBalance,
                  assets: String(assetsManaged),
                },
              ],
        };

        const parsed = TreasuryDocumentSchemaZ.parse(treasuryData);

        const result = await TreasuryModel.findOneAndUpdate(
          { dao_name: foundDao.name.toLowerCase() },
          parsed,
          {
            upsert: true, // Create if doesn't exist
            new: true, // Return the modified document
            setDefaultsOnInsert: true,
          }
        );

        if (result.date_added.getTime() === date.getTime()) {
          await logAction({
            action: "logAction",
            message: `**Created new entry and finished refreshing ${foundDao.name} treasury stats (Treasury: $${treasuryHoldings.usdBalance}, Assets: $${assetsManaged.toFixed(2)}, Total: $${(Number(treasuryHoldings.usdBalance) + assetsManaged).toFixed(2)}) ${generateDiscordTimestamp(new Date(), "R")}**`,
          });
        } else {
          await logAction({
            action: "logAction",
            message: `**Finished refreshing ${foundDao.name} treasury stats (Treasury: $${treasuryHoldings.usdBalance}, Assets: $${assetsManaged.toFixed(2)}, Total: $${(Number(treasuryHoldings.usdBalance) + assetsManaged).toFixed(2)}) ${generateDiscordTimestamp(new Date(), "R")}**`,
          });
        }
        continue;
      } catch (err) {
        await logErrorEmbed(
          `Error occurred refreshing treasury: ${foundDao.name}`
        );
      }
    }
  } catch (err) {
    await logErrorEmbed(
      `Error occurred refreshing treasury within fetchAndUpdateTreasuries: ${err}`
    );
  } finally {
    await logAction({
      action: "logAction",
      message: `**Full treasury refresh completed ${generateDiscordTimestamp(new Date(), "R")}**`,
    });
  }
}

export default fetchAndUpdateTreasuries;
