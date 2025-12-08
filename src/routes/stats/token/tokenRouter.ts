import { Router } from "express";

import { fetchTokenHoldersChart } from "../chart/databaseCharts";
import { fetchExternalChart } from "../chart/externalTokenPrice";

import { fetchTokenData } from "./fetchToken";
import { refreshTokenStats } from "./refreshToken";

const router = Router();

router.get("/:tokenName", fetchTokenData);
router.post("/refresh/:tokenName", refreshTokenStats);

router.get("/chart/:chartType/:tokenName/:timeFrame", fetchExternalChart);
router.get("/chart/holders/:tokenName", fetchTokenHoldersChart);

export default router;
