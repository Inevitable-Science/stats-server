import type { Request, Response } from "express";

import type { DAO } from "../../../config/constants";
import { daos } from "../../../config/constants";
import TokenModel from "../../../config/models/tokenSchema";
import TreasuryModel from "../../../config/models/treasurySchema";

// Interface for the detailed DAO response
interface DaoResponse {
  name: string;
  logo: string;
  backdrop: string;
  description: string;
  date_created: string;
  payments: number;
  eth_raised: string;
  tags: string;
  socials: {
    site: string | null;
    linked_in: string | null;
    x: string | null;
    discord: string | null;
  };
  treasuryHoldings: string | null;
  assetsUnderManagement: number | null;
  nativeToken: {
    name: string | null;
    address: string | null;
    mc_ticker: string | null;
    totalSupply: number | null;
    totalHolders: string | null;
    marketCap: number | null;
  };
}

export function fetchDaosPreview(req: Request, res: Response): void {
  const daosData = daos.map((dao: DAO) => ({
    name: dao.name,
    description: dao.description,
    ticker: dao.ticker,
    backdrop_url: dao.backdrop_url,
    logo_url: dao.logo_url,
  }));

  res.json(daosData);
}

export async function fetchDao(req: Request, res: Response): Promise<void> {
  try {
    const { dao } = req.params;

    if (!dao) {
      res.status(400).json({ error: "Missing required parameter: dao" });
      return;
    }

    const foundDao = daos.find(
      (d) =>
        d.name.toLowerCase() === dao.toLowerCase() ||
        d.ticker.toLowerCase() === dao.toLowerCase() ||
        d.alternative_names?.some((alt) => alt.toLowerCase() === dao.toLowerCase())
    );

    if (!foundDao) {
      res.status(404).json({ error: "DAO not found" });
      return;
    }

    const [tokenEntry, treasuryEntry] = await Promise.all([
      await TokenModel.findOne({ token_address: foundDao.native_token.token_address }),
      await TreasuryModel.findOne({
        dao_name: foundDao.name.toLowerCase(),
      }),
    ]);

    // Calculate assets under management
    let assetsUnderManagement: number | null = null;
    if (treasuryEntry?.total_treasury_value && treasuryEntry?.total_assets) {
      const totalTreasuryValue = parseFloat(treasuryEntry.total_treasury_value) || 0;
      const totalAssets = parseFloat(treasuryEntry.total_assets) || 0;
      assetsUnderManagement = totalTreasuryValue + totalAssets;
    }

    // TODO: Simplify construction of the response
    // Structure the response data
    const response: DaoResponse = {
      name: foundDao.name,
      logo: foundDao.logo_url,
      backdrop: foundDao.backdrop_url,
      description: foundDao.description,
      date_created: foundDao.date_created,
      payments: foundDao.payments,
      eth_raised: foundDao.eth_raised,
      tags: foundDao.tag,
      socials: {
        site: foundDao.socials?.site || null,
        linked_in: foundDao.socials?.linked_in || null,
        x: foundDao.socials?.x || null,
        discord: foundDao.socials?.discord || null,
      },
      treasuryHoldings: treasuryEntry?.total_treasury_value || null,
      assetsUnderManagement,
      nativeToken: {
        name: foundDao.native_token?.name || null,
        address: foundDao.native_token?.token_address || null,
        mc_ticker: foundDao.native_token?.mc_ticker || null,
        totalSupply: tokenEntry?.total_supply || null,
        totalHolders: tokenEntry?.total_holders || null,
        marketCap: tokenEntry?.market_cap || null,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching DAO data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
