import { Router, Request, Response } from 'express';

const tokenList = {
    "name": "Inevitable Sciences Token List",
    "timestamp": "2025-03-08T12:34:09Z",
    "version": {
        "major": 0,
        "minor": 0,
        "patch": 1
    },
    "logoURI": "https://inevitable.science/assets/img/branding/manifest/android-chrome-192x192.png",
    "keywords": [
        "default",
        "list"
    ],
    "tokens": [
      {
        "chainId": 1,
        "address": "0xf4308b0263723b121056938c2172868e408079d0",
        "name": "CryoDAO",
        "decimals": 18,
        "symbol": "CRYO",
        "logoURI": "https://www.profiler.bio/web3/tokenlistAssets/cryo_token.png"
      },
      {
        "chainId": 1,
        "address": "0x4cd1B2874e020C5bf08c4bE18Ab69ca86EC25fEf",
        "decimals": 18,
        "symbol": "CRYORAT",
        "logoURI": "https://coin-images.coingecko.com/coins/images/52533/large/cryorat-tp.png?1733583635"
      },
      {
        "chainId": 1,
        "address": "0xaf04f0912e793620824f4442b03f4d984af29853",
        "name": "HydraDAO",
        "decimals": 18,
        "symbol": "HYDRA",
        "logoURI": "https://assets.coingecko.com/coins/images/54421/large/hydra-icon.png?1739603226"
      },
      {
        "chainId": 1,
        "address": "0xFdc9D2A3cae56e484a85de3C2e812784a8184d0D",
        "name": "ErectusDAO",
        "decimals": 18,
        "symbol": "YUGE",
        "logoURI": "https://www.profiler.bio/web3/tokenlistAssets/yuge_token.png"
      }
    ]
};

const router = Router();

router.get('/', (req: Request, res: Response): void => {
  res.json(tokenList);
});

export default router;