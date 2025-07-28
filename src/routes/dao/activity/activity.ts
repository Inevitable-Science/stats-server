import express, { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { daos, DAO } from '../../../config/constants';

interface Transaction {
  Date: string;
  'ETH paid': string;
  'USD value of ETH paid': string;
  Payer: string;
  Beneficiary: string;
  'Transaction hash': string;
}

const router: Router = express.Router();

router.get('/:dao', async (req: Request, res: Response) => {
  try {
    const { dao } = req.params;
    
    if (!dao) {
      res.status(400).json({ error: 'Missing required parameter: dao' });
      return;
    }
  
    const foundDao = daos.find((d: DAO) =>
      d.name.toLowerCase() === dao.toLowerCase() ||
      d.ticker.toLowerCase() === dao.toLowerCase() ||
      d.alternative_names?.some(
        (alt) => alt.toLowerCase() === dao.toLowerCase()
      )
    );
  
    if (!foundDao) {
      res.status(404).json({ error: 'DAO not found' });
      return;
    }

    // Get pagination parameters from query
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const startIndex = (page - 1) * limit;

    // Define filepath
    //const csvFilePath = path.join(__dirname, `/dump/${foundDao.name.toLowerCase()}.csv`);
    const csvFilePath = path.resolve(process.cwd(), 'src/routes/dao/activity/dump', `${foundDao.name.toLowerCase()}.csv`);

    if (!fs.existsSync(csvFilePath)) {
      res.status(404).json({ error: 'Activity Data Not Found' });
      return;
    }

    const transactions: Transaction[] = [];

    fs.createReadStream(csvFilePath)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row: Transaction) => {
        transactions.push(row);
      })
      .on('end', () => {

        const totalItems = transactions.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedData = transactions.slice(startIndex, startIndex + limit);


        res.json({
          page,
          limit,
          totalItems,
          totalPages,
          data: paginatedData,
        });
      })
      .on('error', (error) => {
        console.error('Error parsing CSV:', error);
        res.status(500).json({ error: 'Failed to parse CSV file' });
      });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;