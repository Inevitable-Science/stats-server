// src/routes/holders_chart.ts
import { Request, Response } from "express";
import TokenModel from "../../../config/models/tokenSchema";
import TreasuryModel, {
  TreasuryDocument,
} from "../../../config/models/treasurySchema";
import { daos } from "../../../config/constants";
import { ErrorCodes } from "../../../utils/errors";
import z from "zod";
import { logErrorEmbed } from "../../../utils/coms/logAction";

export async function fetchTokenHoldersChart(req: Request, res: Response): Promise<void> {
  try {
    const { tokenName } = req.params;

    const parsedTokenName = z.string().nonempty().safeParse(tokenName);
    if (!parsedTokenName.success) {
      res.status(400).json({ error: ErrorCodes.BAD_REQUEST });
      return;
    }

    // Find the DAO that matches the token
    const foundDao = daos.find(dao => 
      dao.name.toLowerCase() === parsedTokenName.data.toLowerCase() ||
      dao.native_token.name.toLowerCase() === parsedTokenName.data.toLowerCase() ||
      dao.native_token.mc_ticker.toLowerCase() === parsedTokenName.data.toLowerCase()
    );

    if (!foundDao) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    const tokenEntry = await TokenModel.findOne({
      token_address: foundDao.native_token.token_address.toLowerCase(),
    });

    if (!tokenEntry) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    const cleanedGraph = tokenEntry.holders_graph.filter(
      (item) => !(Array.isArray(item) && item.length === 0)
    );

    // Send the response
    res.json({
      holders: cleanedGraph,
    });

  } catch (err) {
    await logErrorEmbed(`Error serving holders chart ${err}`);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
    return;
  }
};



const removeDuplicates = (data: [number, number][]): [number, number][] => {
  const map = new Map<number, number>();
  data.forEach(([date, value]) => {
    if (!map.has(date)) {
      map.set(date, value);
    }
  });
  return Array.from(map.entries()) as [number, number][];
};

export async function fetchHistoricalTreasuryChart(req: Request, res: Response): Promise<void> {
  try {
    const { daoName } = req.params;
    const parsedDao = z.string().nonempty().safeParse(daoName);

    if (!parsedDao.success) {
      res.status(400).json({ error: ErrorCodes.BAD_REQUEST });
      return;
    }

    const passedDao = parsedDao.data;
    const foundDao = daos.find(dao =>
      dao.name.toLowerCase() === passedDao.toLowerCase() ||
      dao.alternative_names?.some(
        alt => alt.toLowerCase() === passedDao.toLowerCase()
      )
    );

    if (!foundDao) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({
      dao_name: foundDao.name.toLowerCase(),
    });

    if (!treasuryEntry || !treasuryEntry.historical_treasury) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    const historicalTreasuryValue: [number, number][] =
      treasuryEntry.historical_treasury.map(
        (entry) =>
          [
            new Date(
              new Date(entry.date).toISOString().split("T")[0] +
                "T00:00:00.000Z"
            ).getTime(),
            parseFloat(entry.balance),
          ] as [number, number]
      );

    const historicalAssetsValue: [number, number][] =
      treasuryEntry.historical_treasury.map(
        (entry) =>
          [
            new Date(
              new Date(entry.date).toISOString().split("T")[0] +
                "T00:00:00.000Z"
            ).getTime(),
            parseFloat(entry.assets),
          ] as [number, number]
      );

    const totalHistoricalValue: [number, number][] =
      treasuryEntry.historical_treasury.map(
        (entry) =>
          [
            new Date(
              new Date(entry.date).toISOString().split("T")[0] +
                "T00:00:00.000Z"
            ).getTime(),
            parseFloat(entry.balance) + parseFloat(entry.assets),
          ] as [number, number]
      );

    // Remove duplicates from each historical data
    const uniqueHistoricalTreasuryValue = removeDuplicates(historicalTreasuryValue);
    const uniqueHistoricalAssetsValue = removeDuplicates(historicalAssetsValue);
    const uniqueTotalHistoricalValue = removeDuplicates(totalHistoricalValue);

    // Structure the response data
    const response = {
      historical_treasury: uniqueHistoricalTreasuryValue,
      historical_assets: uniqueHistoricalAssetsValue,
      total_assets: uniqueTotalHistoricalValue,
    };

    // Send the response
    res.json(response);
  } catch (err) {
    await logErrorEmbed(`Error serving historical chart data ${err}`);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
    return;
  }
};
