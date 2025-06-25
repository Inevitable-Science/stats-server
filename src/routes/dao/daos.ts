/*// src/routes/daos.ts
import { Router, Request, Response } from 'express';
import { daos, DAO } from '../../config/constants';
import TreasuryModel, { TreasuryDocument } from '../../config/models/treasury_schema';
import TokenModel, { TokenDocument } from '../../config/models/token_schema';

const router = Router();

// Interface for the simplified DAO data returned by the route
interface SimplifiedDao {
  name: string;
  description: string;
  ticker: string;
  ecosystem: string | null;
  backdrop_url: string;
  logo_url: string;
}

function fetchDaosData(): SimplifiedDao[] {
  return daos.map((dao: DAO) => ({
    name: dao.name,
    description: dao.description,
    ticker: dao.ticker,
    ecosystem: dao.ecosystem,
    backdrop_url: dao.backdrop_url,
    logo_url: dao.logo_url,
  }));
}


router.get('/', (req: Request, res: Response): void => {
  const daosData: SimplifiedDao[] = fetchDaosData();
  res.json(daosData);
});

router.get('/dao/:dao', (req, res: ): void => {
  const { dao } = req.params;

  if (!dao) {
    return res.status(400).json({ error: 'Missing required parameter: dao' });
  }

  // Find the DAO by name or ticker (case-insensitive)
  const foundDao = daos.find(
    (d) => d.name.toLowerCase() === dao.toLowerCase() || d.ticker.toLowerCase() === dao.toLowerCase()
  );

  if (!foundDao) {
    return res.status(404).json({ error: 'DAO not found' });
  }

  const tokenAddress = foundDao.native_token.token_address;
  const tokenEntry = await TokenModel.findOne({ token_address: tokenAddress });
  
  const daoNameQuery = foundDao.name.toLowerCase();
  const treasuryEntry = await TreasuryModel.findOne({ dao_name: daoNameQuery });

  const addedAssets = 
  +treasuryEntry?.total_treasury_value + 
  +treasuryEntry?.total_assets;

  // Structure the response data
  const response = {
    name: foundDao.name,
    logo: foundDao.logo_url,
    tags: foundDao.tag,
    ecosystem: foundDao.ecosystem,
    ecosystemSite: foundDao.ecosystem_url,
    socials: foundDao.socials,
    description: foundDao.description,
    treasuryHoldings: treasuryEntry?.total_treasury_value,
    assetsUnderManagement: addedAssets,
    nativeToken: {
      name: foundDao.native_token?.name,
      address: foundDao.native_token?.token_address,
      mc_ticker: foundDao.native_token?.mc_ticker,
      totalSupply: tokenEntry?.total_supply || null,
      totalHolders: tokenEntry?.total_holders || null,
      marketCap: tokenEntry?.market_cap || null,
    },
    ipt: foundDao.ipt
      ? Object.values(foundDao.ipt).map(item => ({
          name: item?.name,
          backdrop: item?.backdrop_url,
          logo: item?.logo_url,
          description: item?.description,
          tokenType: item?.token_type,
        }))
      : null,
  };
})

export default router;
*/

// src/routes/daos.ts
import { Router, Request, Response } from 'express';
import { daos, DAO } from '../../config/constants';
import TreasuryModel, { TreasuryDocument } from '../../config/models/treasury_schema';
import TokenModel, { TokenDocument } from '../../config/models/token_schema';

// Interface for the simplified DAO data returned by the root route
interface SimplifiedDao {
  name: string;
  description: string;
  ticker: string;
  ecosystem: string | null;
  backdrop_url: string;
  logo_url: string;
}

// Interface for the detailed DAO response
interface DaoResponse {
  name: string;
  logo: string;
  tags: string;
  ecosystem: string | null;
  ecosystemSite: string | null;
  socials: {
    site: string | null;
    linked_in: string | null;
    x: string | null;
    discord: string | null;
  };
  description: string;
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
  ipt: Array<{
    name: string | null;
    backdrop: string | null;
    logo: string | null;
    description: string | null;
    tokenType: string | null;
  }> | null;
}

function fetchDaosData(): SimplifiedDao[] {
  return daos.map((dao: DAO) => ({
    name: dao.name,
    description: dao.description,
    ticker: dao.ticker,
    ecosystem: dao.ecosystem,
    backdrop_url: dao.backdrop_url,
    logo_url: dao.logo_url,
  }));
}

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  const daosData: SimplifiedDao[] = fetchDaosData();
  res.json(daosData);
});

router.get('/:dao', async (req: Request, res: Response): Promise<void> => {
  const { dao } = req.params;

  if (!dao) {
    res.status(400).json({ error: 'Missing required parameter: dao' });
    return;
  }

  // Find the DAO by name or ticker (case-insensitive)
  const foundDao = daos.find(
    (d) => d.name.toLowerCase() === dao.toLowerCase() || d.ticker.toLowerCase() === dao.toLowerCase()
  );

  if (!foundDao) {
    res.status(404).json({ error: 'DAO not found' });
    return;
  }

  try {
    // Fetch token data
    const tokenAddress = foundDao.native_token?.token_address;
    let tokenEntry: TokenDocument | null = null;
    if (tokenAddress) {
      tokenEntry = await TokenModel.findOne({ token_address: tokenAddress });
    }

    // Fetch treasury data
    const daoNameQuery = foundDao.name.toLowerCase();
    const treasuryEntry: TreasuryDocument | null = await TreasuryModel.findOne({ dao_name: daoNameQuery });

    // Calculate assets under management
    let assetsUnderManagement: number | null = null;
    if (treasuryEntry?.total_treasury_value && treasuryEntry?.total_assets) {
      const totalTreasuryValue = parseFloat(treasuryEntry.total_treasury_value) || 0;
      const totalAssets = parseFloat(treasuryEntry.total_assets) || 0;
      assetsUnderManagement = totalTreasuryValue + totalAssets;
    }

    // Structure the response data
    const response: DaoResponse = {
      name: foundDao.name,
      logo: foundDao.logo_url,
      tags: foundDao.tag,
      ecosystem: foundDao.ecosystem,
      ecosystemSite: foundDao.ecosystem_url,
      socials: {
        site: foundDao.socials?.site || null,
        linked_in: foundDao.socials?.linked_in || null,
        x: foundDao.socials?.x || null,
        discord: foundDao.socials?.discord || null,
      },
      description: foundDao.description,
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
      ipt: foundDao.ipt
        ? Object.values(foundDao.ipt).map(item => ({
            name: item?.name || null,
            backdrop: item?.backdrop_url || null,
            logo: item?.logo_url || null,
            description: item?.description || null,
            tokenType: item?.token_type || null,
          }))
        : null,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching DAO data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;