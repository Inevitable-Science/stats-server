// src/routes/treasury.ts
import type { Request, Response } from "express";
import z from "zod";

import { daos } from "../../../../config/constants";
import type { TreasuryDocument } from "../../../../config/models/treasurySchema";
import TreasuryModel from "../../../../config/models/treasurySchema";
import logAction, { logErrorEmbed } from "../../../../utils/coms/logAction";
import { ErrorCodes } from "../../../../utils/errors";
import getAssetsManaged from "../../../../utils/fetch/treasury/assetsManaged";
import type { TreasuryHoldingsResponse } from "../../../../utils/fetch/treasury/treasuryHoldings";
import getTreasuryHoldings from "../../../../utils/fetch/treasury/treasuryHoldings";
import { generateDiscordTimestamp } from "../../../../utils/utils";

let isRunning = false;

export async function refreshTreasuryData(req: Request, res: Response): Promise<void> {
  try {
    const { daoName } = req.params;
    const parsedDao = z.string().nonempty().parse(daoName);

    if (isRunning) {
      await logAction({
        action: "logAction",
        message: `**REJECTED request to refresh treasury stats for ${parsedDao} ${generateDiscordTimestamp(new Date(), "R")}: Function already running**`,
      });
      res.status(429).json({ error: ErrorCodes.JOB_ALREADY_RUNNING });
      return;
    }

    const foundDao = daos.find((dao) => dao.name.toLowerCase() === parsedDao.toLowerCase());
    if (!foundDao) {
      res.status(404).json({ error: "DAO not found" });
      return;
    }

    const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({
      dao_name: foundDao.name.toLowerCase(),
    });
    const date = new Date();

    if (treasuryEntry) {
      const lastUpdated = treasuryEntry.last_updated;
      const timeDifference = (date.getTime() - lastUpdated.getTime()) / 1000 / 60;
      if (timeDifference < 15) {
        await logAction({
          action: "logAction",
          message: `**REJECTED request to refresh treasury for ${foundDao.name} ${generateDiscordTimestamp(new Date(), "R")}: 15 minute grace period**`,
        });
        res.status(400).json({
          error: "Please wait 15 minutes before requesting a data update again.",
        });
        return;
      }
    }

    await logAction({
      action: "logAction",
      message: `**Request to refresh treasury stats for ${foundDao.name} ${generateDiscordTimestamp(new Date(), "R")}**`,
    });

    res.status(202).json({ message: "Processing request in the background" });
    isRunning = true;

    setImmediate(async () => {
      try {
        const managedAccounts = foundDao.managed_accounts.map((acc) => acc.address);
        const mappedChainId = foundDao.managed_accounts.map((acc) => acc.chain_id);

        const [assetsManaged, treasuryHoldings]: [number, TreasuryHoldingsResponse] =
          await Promise.all([
            getAssetsManaged(managedAccounts, mappedChainId),
            getTreasuryHoldings(foundDao.treasury.address, foundDao.treasury.chain_id),
          ]);

        if (!treasuryHoldings) throw new Error("Couldn't fetch treasuryHoldings");
        console.log(assetsManaged, "ASSETS");
        console.log(treasuryHoldings, "TREASURY");

        const constructedEntry = {
          dao_name: foundDao.name.toLowerCase(),
          date_added: treasuryEntry ? treasuryEntry.date_added : date,
          last_updated: date,
          total_treasury_value: Number(treasuryHoldings.usdBalance),
          total_assets: assetsManaged,
          tokens: treasuryHoldings.tokens,
          historical_treasury: treasuryEntry
            ? [
                ...treasuryEntry.historical_treasury,
                {
                  date,
                  balance: Number(treasuryHoldings.usdBalance),
                  assets: assetsManaged,
                },
              ]
            : [
                {
                  date,
                  balance: Number(treasuryHoldings.usdBalance),
                  assets: assetsManaged,
                },
              ],
        };

        await TreasuryModel.updateOne(
          { dao_name: constructedEntry.dao_name },
          { $set: constructedEntry },
          { upsert: true }
        );
        await logAction({
          action: "logAction",
          message: `**Completed refreshing treasury stats for ${foundDao.name} ${generateDiscordTimestamp(new Date(), "R")}: (Treasury: $${treasuryHoldings.usdBalance} - Assets: $${assetsManaged.toFixed(2)})**`,
        });
      } catch (err) {
        await logErrorEmbed(
          `**FAILED TO REFRESH TREASURY STATS FOR ${foundDao.name} ${generateDiscordTimestamp(new Date(), "R")}**`
        );
      } finally {
        isRunning = false;
      }
    });
  } catch (err) {
    await logErrorEmbed(`Error initiating manual treasury refresh: ${err}`);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  } finally {
    isRunning = false;
  }
}
