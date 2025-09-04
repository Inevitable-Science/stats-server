import { Router, Request, Response } from 'express';
const path = require('path');

const router = Router();

/*router.get('/', (req: Request, res: Response): void => {
  res.json(tokenList);
});*/

router.get('/tokenlist.schema.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'tokenlist.schema.json'));
});

export default router;