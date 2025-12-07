import fs from "fs";
import path from "path";

import { parse } from "csv-parse";
import type { Request, Response } from "express";
import z from "zod";

import type { DAO } from "../../../../config/constants";
import { daos } from "../../../../config/constants";


interface Transaction {
  Date: string;
  "ETH paid": string;
  "USD value of ETH paid": string;
  Payer: string;
  Beneficiary: string;
  "Transaction hash": string;
}

export async function fetchLegacyActivity(req: Request, res: Response): Promise<void> {
  try {
    const { dao } = req.params;
    const parsedDao = z.string().nonempty().parse(dao);

    const foundDao = daos.find(
      (d: DAO) =>
        d.name.toLowerCase() === parsedDao.toLowerCase() ||
        d.ticker.toLowerCase() === parsedDao.toLowerCase() ||
        d.alternative_names?.some(
          (alt) => alt.toLowerCase() === parsedDao.toLowerCase()
        )
    );

    if (!foundDao) {
      res.status(404).json({ error: "DAO not found" });
      return;
    }

    // Get pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const startIndex = (page - 1) * limit;

    // Define filepath
    const csvFilePath = path.resolve(
      process.cwd(),
      "src/routes/stats/dao/legacy/dump",
      `${foundDao.name.toLowerCase()}.csv`
    );

    if (!fs.existsSync(csvFilePath)) {
      res.status(404).json({ error: "Activity Data Not Found" });
      return;
    }

    const transactions: Transaction[] = [];

    fs.createReadStream(csvFilePath)
      .pipe(parse({ columns: true, trim: true }))
      .on("data", (row: Transaction) => {
        transactions.push(row);
      })
      .on("end", () => {
        const totalItems = transactions.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedData = transactions.slice(
          startIndex,
          startIndex + limit
        );
        
        const mappedPageData = paginatedData.map(tx => {
          return {
            date: tx.Date,
            eth_paid: tx["ETH paid"],
            usd_value: tx["USD value of ETH paid"],
            payer_address: tx.Payer,
            beneficiary: tx.Beneficiary,
            transaction_hash: tx["Transaction hash"]
          }
        });

        res.json({
          page,
          limit,
          totalItems,
          totalPages,
          data: mappedPageData,
        });
        return;
      })
      .on("error", (error) => {
        console.error("Error parsing CSV:", error);
        res.status(500).json({ error: "Failed to parse CSV file" });
      });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};