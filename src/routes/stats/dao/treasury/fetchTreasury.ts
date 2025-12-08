// src/routes/treasury.ts
import type { Request, Response } from "express";
import type { Address } from "viem";
import z from "zod";

import type { ManagedAccount } from "../../../../config/constants";
import { daos } from "../../../../config/constants";
import type {
  TreasuryDocument,
  HistoricalTreasury,
} from "../../../../config/models/treasurySchema";
import TreasuryModel from "../../../../config/models/treasurySchema";
import { logErrorEmbed } from "../../../../utils/coms/logAction";
import { ErrorCodes } from "../../../../utils/errors";

// Interface for the treasury response
interface TreasuryResponse {
  name: string;
  logo: string;
  description: string;
  tags: string;
  socials: {
    site: string | null;
    linked_in: string | null;
    x: string | null;
    discord: string | null;
  };
  treasury: {
    address: Address;
    ens_name: string;
  };
  signers: {
    required: number;
    total: number;
    signers: string[];
  };
  managed_accounts: ManagedAccount[];
  treasuryValue: number;
  assetsUnderManagement: number;
  lastUpdated: Date;
  treasuryTokens: Array<{
    metadata: {
      name: string;
      symbol: string;
      decimals: number;
    };
    contractAddress: string;
    rawBalance: string;
    decodedBalance: number;
    price: number;
    totalValue: number;
  }>;
  historicalReturns: {
    dateRange: string;
    pastValue: number | string;
    dollarReturn: string;
    percentReturn: string;
  }[];
}

function getClosestValue(historicalData: HistoricalTreasury[], targetTime: number): number | null {
  if (!historicalData || historicalData.length === 0) {
    console.warn("historicalData is empty or invalid");
    return null;
  }

  const closestEntry = historicalData.reduce((prev, curr) => {
    const currTime = new Date(curr.date).getTime();
    const prevTime = new Date(prev.date).getTime();
    const currDiff = Math.abs(currTime - targetTime);
    const prevDiff = Math.abs(prevTime - targetTime);
    return currDiff < prevDiff ? curr : prev;
  });

  const closestTime = new Date(closestEntry.date).getTime();
  const timeDiffHours = Math.abs(closestTime - targetTime) / (1000 * 60 * 60);

  // Optional: Add a threshold to avoid using overly distant data
  const maxDiffHours = 48; // Allow entries within 48 hours
  if (timeDiffHours > maxDiffHours) {
    console.warn(
      `Closest entry (${closestEntry.date}) is ${timeDiffHours.toFixed(2)} hours from target, exceeding ${maxDiffHours} hours`
    );
    return null;
  }

  const balance = parseFloat(closestEntry.balance);
  if (isNaN(balance)) {
    console.warn(`Invalid balance in closest entry: ${closestEntry.balance}`);
    return null;
  }

  console.log(
    `Closest entry for ${targetTime} (${new Date(targetTime)}): ${closestEntry.date}, Balance: ${balance}`
  );
  return balance;
}

export async function fetchTreasuryData(req: Request, res: Response): Promise<void> {
  try {
    const { daoName } = req.params;
    const parsedDao = z.string().nonempty().safeParse(daoName);

    if (!parsedDao.success) {
      res.status(400).json({ error: ErrorCodes.BAD_REQUEST });
      return;
    }
    const passedDaoName = parsedDao.data;

    const foundDao = daos.find(
      (dao) =>
        dao.name.toLowerCase() === passedDaoName ||
        dao.ticker.toLowerCase() === passedDaoName ||
        dao.alternative_names?.some((altName) => altName.toLowerCase() === passedDaoName)
    );

    if (!foundDao) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    // Fetch treasury data
    const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({
      dao_name: foundDao.name.toLowerCase(),
    });

    if (!treasuryEntry) {
      res.status(404).json({ error: ErrorCodes.ENTRY_NOT_FOUND });
      return;
    }

    // Calculate assets under management
    const treasuryValue = parseFloat(treasuryEntry.total_treasury_value) ?? 0;
    const assetsValue = parseFloat(treasuryEntry.total_assets) ?? 0;
    const assetsUnderManagement = treasuryValue + assetsValue;

    // Calculate historical treasury returns
    const now = new Date().getTime();
    const timeOffsets: { [key: string]: number } = {
      "24h": now - 24 * 60 * 60 * 1000,
      "48h": now - 48 * 60 * 60 * 1000,
      "1w": now - 7 * 24 * 60 * 60 * 1000,
      "1m": now - 30 * 24 * 60 * 60 * 1000,
    };

    const historicalTreasury = treasuryEntry.historical_treasury || [];
    const treasuryChanges: TreasuryResponse["historicalReturns"] = [];

    Object.keys(timeOffsets).forEach((dateRange) => {
      const pastValue = getClosestValue(historicalTreasury, timeOffsets[dateRange]);

      if (pastValue === null) {
        treasuryChanges.push({
          dateRange: dateRange,
          pastValue: "N/A",
          dollarReturn: "N/A",
          percentReturn: "N/A",
        });
        return;
      }

      const dollarReturn = treasuryValue - pastValue;
      const percentReturn = pastValue > 0 ? ((dollarReturn / pastValue) * 100).toFixed(2) : "N/A";

      const formattedDollarReturn =
        dollarReturn < 0
          ? `-$${Math.abs(dollarReturn)
              .toFixed(2)
              .replace(/\d(?=(\d{3})+\.)/g, "$&,")}`
          : `$${dollarReturn.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;

      treasuryChanges.push({
        dateRange: dateRange,
        pastValue,
        dollarReturn: formattedDollarReturn,
        percentReturn: percentReturn + "%",
      });
    });

    // Structure the response data
    const response: TreasuryResponse = {
      name: foundDao.name,
      logo: foundDao.logo_url,
      description: foundDao.description,
      tags: foundDao.tag,
      socials: {
        site: foundDao.socials.site || null,
        linked_in: foundDao.socials.linked_in || null,
        x: foundDao.socials.x || null,
        discord: foundDao.socials.discord || null,
      },
      treasury: foundDao.treasury,
      signers: foundDao.signers,
      managed_accounts: foundDao.managed_accounts,
      treasuryValue,
      assetsUnderManagement,
      lastUpdated: treasuryEntry.last_updated,
      treasuryTokens: treasuryEntry.tokens,
      historicalReturns: treasuryChanges,
    };

    res.json(response);
    return;
  } catch (err) {
    await logErrorEmbed(`Error serving treasury data: ${err}`);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
}
