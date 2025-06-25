// src/routes/holders_chart.ts
import { Router, Request, Response } from 'express';
import TokenModel from '../../config/models/token_schema';
import TreasuryModel, { TreasuryDocument } from '../../config/models/treasury_schema';
import { daos, DAO, NativeToken, IPTEntry } from '../../config/constants';

const router = Router();
// Define the route handler

router.get('/holders/:token', async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  if (!token) {
    res.status(400).json({ error: 'Missing required parameter: token' });
    return;
  }

  let isIptToken = false;

  // Find the DAO that matches the token
  const foundDao = daos.find((d: DAO) => {
    // Check if the token matches native_token.name
    if (d.native_token.name.toLowerCase() === token.toLowerCase()) {
      return true;
    }

    // Check if any IPT object has the token name and is of type ERC-20
    if (d.ipt) {
      return Object.keys(d.ipt).some((key) => {
        if (
          d.ipt![key].name.toLowerCase() === token.toLowerCase() &&
          d.ipt![key].token_type === 'ERC-20'
        ) {
          isIptToken = true; // Set to true if IPT token is found
          return true;
        }
        return false;
      });
    }

    return false;
  });

  if (!foundDao) {
    res.status(404).json({ error: 'Token not found in any DAO' });
    return;
  }

  // Sanitize and find token from either native_token or ipt
  let tokenStats: NativeToken | IPTEntry = foundDao.native_token; // Default to native_token

  if (foundDao.ipt) {
    // Find the matching IPT name dynamically
    const iptToken = Object.keys(foundDao.ipt).find(
      (key) => foundDao.ipt![key].name.toLowerCase() === token.toLowerCase()
    );
    if (iptToken) {
      tokenStats = foundDao.ipt[iptToken]; // Update tokenStats to IPT token
    }
  }

  const tokenAddress = tokenStats.token_address;
  const tokenEntry = await TokenModel.findOne({ token_address: tokenAddress });

  if (!tokenEntry) {
    res.status(404).json({ error: 'Token entry not found' });
    return;
  }

  const cleanedGraph = tokenEntry.holders_graph.filter(item => !(Array.isArray(item) && item.length === 0));

  // Structure the response data
  const response = {
    holders: cleanedGraph,
  };

  // Send the response
  res.json(response);
});




// Route to fetch historical treasury data
router.get('/treasury/:dao', async (req: Request, res: Response): Promise<void> => {
  const { dao } = req.params;

  if (!dao) {
    res.status(400).json({ error: 'Missing required parameter: dao' });
    return;
  }

  const foundDao = daos.find((d: DAO) => d.name.toLowerCase() === dao.toLowerCase());

  if (!foundDao) {
    res.status(404).json({ error: 'DAO not found' });
    return;
  }

  const lowercaseName = foundDao.name.toLowerCase();

  const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({ dao_name: lowercaseName });

  if (!treasuryEntry || !treasuryEntry.historical_treasury) {
    res.status(404).json({ error: 'Treasury data not found' });
    return;
  }

  const historicalTreasuryValue: [number, number][] = treasuryEntry.historical_treasury.map((entry) => [
    new Date(new Date(entry.date).toISOString().split('T')[0] + 'T00:00:00.000Z').getTime(),
    parseFloat(entry.balance),
  ] as [number, number]);

  const historicalAssetsValue: [number, number][] = treasuryEntry.historical_treasury.map((entry) => [
    new Date(new Date(entry.date).toISOString().split('T')[0] + 'T00:00:00.000Z').getTime(),
    parseFloat(entry.assets),
  ] as [number, number]);

  const totalHistoricalValue: [number, number][] = treasuryEntry.historical_treasury.map((entry) => [
    new Date(new Date(entry.date).toISOString().split('T')[0] + 'T00:00:00.000Z').getTime(),
    parseFloat(entry.balance) + parseFloat(entry.assets),
  ] as [number, number]);

  const removeDuplicates = (data: [number, number][]): [number, number][] => {
    const map = new Map<number, number>();
    data.forEach(([date, value]) => {
      if (!map.has(date)) {
        map.set(date, value);
      }
    });
    return Array.from(map.entries()) as [number, number][];
  };

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
});

export default router;