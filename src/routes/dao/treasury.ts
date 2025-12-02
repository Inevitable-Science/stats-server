// src/routes/treasury.ts
import { Router, Request, Response } from "express";
import { daos, DAO, ManagedAccounts } from "../../config/constants";
import TreasuryModel, {
  TreasuryDocument,
  HistoricalTreasury,
} from "../../config/models/treasurySchema";
import sendDiscordMessage from "../../utils/coms/send_message";
import getAssetsManaged from "../../utils/fetch/assetsManaged";
import getTreasuryHoldings from "../../utils/fetch/treasury/treasuryHoldings";
import { Address } from "viem";

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
    address: string;
    ens_name: string;
  };
  signers: {
    required: number;
    total: number;
    signers: string[];
  };
  managed_accounts: {
    [key: Address]: { // TODO: make this an array
      address: Address;
      comment: string;
      ens: string | null;
      chain: string;
    };
  };
  treasuryValue: number;
  assetsUnderManagement: number | null;
  lastUpdated: Date | null;
  treasuryTokens: Array<{
    metadata: {
      name: string;
      symbol: string;
      decimals: number;
    };
    contractAddress: string | null;
    rawBalance: string;
    decodedBalance: number;
    price: number;
    totalValue: number;
  }>;
  historicalReturns: {
    [key: string]: {
      pastValue: number | string;
      dollarReturn: string;
      percentReturn: string;
    };
  };
}

// Interface for token metadata
interface TokenMetadata {
  name: string;
  symbol?: string;
  decimals: number;
  logo?: string;
}

// Interface for token holdings (aligned with WalletData from treasury_holdings.ts)
interface TokenHolding {
  contractAddress: string | null;
  metadata: TokenMetadata;
  rawBalance: string;
  decodedBalance: string;
  price: string | null;
  totalValue: string;
}

// Interface for treasury holdings return type (aligned with treasury_holdings.ts)
interface TreasuryHoldings {
  usdBalance: string;
  tokens: TokenHolding[] | null;
}

// Interface for wallet data (from assets_managed.ts)
interface WalletData {
  [address: string]: {
    chain: "eth" | "sol" | "base" | "poly" | "btc" | "arb";
  };
}

// Helper function to sanitize DAO name
function sanitizeName(name: string): string | null {
  return /^[a-zA-Z0-9]+$/.test(name) ? name : null;
}

/*
// Helper function to get treasury value closest to a target timestamp
function getClosestValue(historicalData: HistoricalTreasury[], targetTime: number): number | null {
  if (!historicalData || historicalData.length === 0) {
    return null;
  }

  const closestEntry = historicalData.reduce((prev, curr) =>
    Math.abs(new Date(curr.date).getTime() - targetTime) < Math.abs(new Date(prev.date).getTime() - targetTime)
      ? curr
      : prev
  );

  // Ensure we don't return a value if it's more recent than the target time
  if (new Date(closestEntry.date).getTime() > targetTime) {
    return null; // No valid past data found
  }

  return parseFloat(closestEntry.balance) || 0;
}*/

function getClosestValue(
  historicalData: HistoricalTreasury[],
  targetTime: number
): number | null {
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

let isRunning = false;

const router = Router();

router.get("/:dao", async (req: Request, res: Response): Promise<void> => {
  const { dao } = req.params;

  if (!dao) {
    res.status(400).json({ error: "Missing required parameter: dao" });
    return;
  }

  // Find the DAO by name or ticker (case-insensitive)
  /*const foundDao = daos.find(
    (d: DAO) => d.name.toLowerCase() === dao.toLowerCase() || d.ticker.toLowerCase() === dao.toLowerCase()
  );*/
  const foundDao = daos.find(
    (d: DAO) =>
      d.name.toLowerCase() === dao.toLowerCase() ||
      d.ticker.toLowerCase() === dao.toLowerCase() ||
      d.alternative_names?.some(
        (alt) => alt.toLowerCase() === dao.toLowerCase()
      )
  );

  if (!foundDao) {
    res.status(404).json({ error: "DAO not found" });
    return;
  }

  const sanitizedName = sanitizeName(foundDao.name)?.toLowerCase();
  if (!sanitizedName) {
    res.status(400).json({ error: "Invalid name format" });
    return;
  }

  try {
    // Fetch treasury data
    const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({
      dao_name: sanitizedName,
    });

    if (!treasuryEntry) {
      res.status(404).json({ error: "Treasury entry not found" });
      return;
    }

    // Calculate assets under management
    let assetsUnderManagement: number | null = null;
    if (treasuryEntry.total_treasury_value && treasuryEntry.total_assets) {
      const totalTreasuryValue =
        parseFloat(treasuryEntry.total_treasury_value) || 0;
      const totalAssets = parseFloat(treasuryEntry.total_assets) || 0;
      assetsUnderManagement = totalTreasuryValue + totalAssets;
    }

    // Get the current treasury balance
    const currentTreasuryValue =
      parseFloat(treasuryEntry.total_treasury_value) || 0;
    // console.log('currentTreasuryValue:', currentTreasuryValue, 'treasuryEntry.total_treasury_value:', treasuryEntry.total_treasury_value);

    // Calculate historical treasury returns
    const now = new Date().getTime();
    const timeOffsets: { [key: string]: number } = {
      "24h": now - 24 * 60 * 60 * 1000,
      "48h": now - 48 * 60 * 60 * 1000,
      "1w": now - 7 * 24 * 60 * 60 * 1000,
      "1m": now - 30 * 24 * 60 * 60 * 1000,
    };

    const historicalTreasury = treasuryEntry.historical_treasury || [];
    // console.log('historicalTreasury:', historicalTreasury);
    const treasuryChanges: TreasuryResponse["historicalReturns"] = {};

    Object.keys(timeOffsets).forEach((key) => {
      const pastValue = getClosestValue(historicalTreasury, timeOffsets[key]);
      // console.log('key:', key, 'timeOffset:', timeOffsets[key], 'pastValue:', pastValue);

      if (pastValue === null) {
        treasuryChanges[key] = {
          pastValue: "N/A",
          dollarReturn: "N/A",
          percentReturn: "N/A",
        };
        return;
      }

      const dollarReturn = currentTreasuryValue - pastValue;
      const percentReturn =
        pastValue > 0 ? ((dollarReturn / pastValue) * 100).toFixed(2) : "N/A";

      const formattedDollarReturn =
        dollarReturn < 0
          ? `-$${Math.abs(dollarReturn)
              .toFixed(2)
              .replace(/\d(?=(\d{3})+\.)/g, "$&,")}`
          : `$${dollarReturn.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, "$&,")}`;

      treasuryChanges[key] = {
        pastValue,
        dollarReturn: formattedDollarReturn,
        percentReturn: percentReturn + "%",
      };
    });

    const managedObject: ManagedAccounts = foundDao.managed_accounts.reduce(
      (acc, account) => {
        acc[account.address] = account;
        return acc;
      },
      {} as ManagedAccounts
    );

    // Structure the response data
    const response: TreasuryResponse = {
      name: foundDao.name,
      logo: foundDao.logo_url,
      description: foundDao.description,
      tags: foundDao.tag,
      socials: {
        site: foundDao.socials?.site || null,
        linked_in: foundDao.socials?.linked_in || null,
        x: foundDao.socials?.x || null,
        discord: foundDao.socials?.discord || null,
      },
      treasury: foundDao.treasury,
      signers: foundDao.signers,
      managed_accounts: managedObject,
      treasuryValue: currentTreasuryValue,
      assetsUnderManagement,
      lastUpdated: treasuryEntry.last_updated || null,
      treasuryTokens: treasuryEntry.tokens.map((token) => ({
        metadata: {
          name: token.metadata.name,
          symbol: token.metadata.symbol,
          decimals: token.metadata.decimals,
        },
        contractAddress: token.contractAddress || null,
        rawBalance: token.rawBalance,
        decodedBalance: token.decodedBalance,
        price: token.price,
        totalValue: token.totalValue,
      })),
      historicalReturns: treasuryChanges,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching treasury data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// curl -X POST http://localhost:3001/treasury/refresh/cryodao

router.post(
  "/refresh/:dao",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { dao } = req.params;

      if (!dao) {
        res.status(400).json({ error: "Missing required parameter: dao" });
        return;
      }

      if (isRunning) {
        await sendDiscordMessage(
          `**REJECTED request to refresh treasury stats for ${dao} at ${new Date().toLocaleString()}: Function already running**`
        );
        res.status(429).json({ error: "We are already fetching new data." });
        return;
      }

      const foundDao = daos.find(
        (d: DAO) => d.name.toLowerCase() === dao.toLowerCase()
      );

      if (!foundDao) {
        res.status(404).json({ error: "DAO not found" });
        return;
      }

      const sanitizedNameUppercase = sanitizeName(dao);
      if (!sanitizedNameUppercase) {
        console.log("Invalid DAO name format.");
        res.status(400).json({ error: "Invalid DAO name format" });
        return;
      }
      const sanitizedName = sanitizedNameUppercase.toLowerCase();

      const entry: TreasuryDocument | null = await TreasuryModel.findOne({
        dao_name: sanitizedName,
      });
      const date = new Date();

      if (entry) {
        const lastUpdated = entry.last_updated; // Assuming last_updated is a Date in TreasuryDocument
        const timeDifference =
          (date.getTime() - lastUpdated.getTime()) / 1000 / 60;
        if (timeDifference < 15) {
          await sendDiscordMessage(
            `**REJECTED request to refresh treasury for ${foundDao.name} at ${new Date().toLocaleString()}: 15 minute grace period**`
          );
          res.status(400).json({
            error:
              "Please wait 15 minutes before requesting a data update again.",
          });
          return;
        }
      }

      await sendDiscordMessage(
        `**Request to refresh treasury stats for ${foundDao.name} at ${new Date().toLocaleString()}**`
      );

      res.status(202).json({ message: "Processing request in the background" });

      isRunning = true;

      setImmediate(async () => {
        try {
          // Transform managed_accounts to WalletData
          /*const walletData: WalletData = Object.keys(
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
          }, {} as WalletData);*/

          const managedAccounts = foundDao.managed_accounts.map(acc => acc.address);
          const mappedChainId = foundDao.managed_accounts.map(acc => acc.chain_id);
          const chainIds = Array.from(new Set(mappedChainId));

          const [assetsManaged, treasuryHoldings]: [number, TreasuryHoldings] =
            await Promise.all([
              getAssetsManaged(managedAccounts, chainIds),
              getTreasuryHoldings(foundDao.treasury.address, foundDao.treasury.chain_id),
            ]);

          console.log(assetsManaged, "ASSETS");
          console.log(treasuryHoldings, "TREASURY");

          if (!entry) {
            const newEntry = new TreasuryModel({
              dao_name: foundDao.name.toLowerCase(),
              date_added: date,
              last_updated: date,
              total_treasury_value: Number(treasuryHoldings.usdBalance),
              total_assets: assetsManaged,
              tokens:
                treasuryHoldings.tokens?.map((token: TokenHolding) => ({
                  contractAddress: token.contractAddress || null,
                  metadata: {
                    name: token.metadata.name || "",
                    symbol: token.metadata.symbol || "",
                    decimals: token.metadata.decimals || 0,
                  },
                  rawBalance: token.rawBalance || "",
                  decodedBalance: Number(token.decodedBalance) || 0,
                  price: Number(token.price) || 0,
                  totalValue: Number(token.totalValue) || 0,
                })) || [],
              historical_treasury: [
                {
                  date,
                  balance: Number(treasuryHoldings.usdBalance),
                  assets: assetsManaged,
                },
              ],
            });

            await newEntry.save();
            await sendDiscordMessage(
              `**Created new entry and completed refreshing treasury stats for ${foundDao.name} at ${new Date().toLocaleString()}**`
            );
          } else {
            const updatedEntry = {
              dao_name: entry.dao_name,
              date_added: entry.date_added,
              last_updated: date,
              total_treasury_value: Number(treasuryHoldings.usdBalance),
              total_assets: assetsManaged,
              tokens:
                treasuryHoldings.tokens?.map((token: TokenHolding) => ({
                  contractAddress: token.contractAddress || null,
                  metadata: {
                    name: token.metadata.name || "",
                    symbol: token.metadata.symbol || "",
                    decimals: token.metadata.decimals || 0,
                  },
                  rawBalance: token.rawBalance || "",
                  decodedBalance: Number(token.decodedBalance) || 0,
                  price: Number(token.price) || 0,
                  totalValue: Number(token.totalValue) || 0,
                })) || [],
              historical_treasury: [
                ...entry.historical_treasury,
                {
                  date,
                  balance: Number(treasuryHoldings.usdBalance),
                  assets: assetsManaged,
                },
              ],
            };

            await TreasuryModel.updateOne(
              { dao_name: updatedEntry.dao_name },
              { $set: updatedEntry }
            );
            await sendDiscordMessage(
              `**Completed refreshing treasury stats for ${foundDao.name} at ${new Date().toLocaleString()}**`
            );
          }
        } catch (err) {
          await sendDiscordMessage(
            `**FAILED TO REFRESH TREASURY STATS FOR ${foundDao.name} @ ${new Date().toLocaleString()}**`
          );
          console.error(`Error occurred refreshing treasury ${dao}:`, err);
        } finally {
          isRunning = false;
        }
      });
    } catch (error) {
      console.error("Error initiating treasury refresh:", error);
      isRunning = false;
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
