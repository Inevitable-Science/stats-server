import { Router } from "express";
import { fetchDao, fetchDaosPreview } from "./fetchDao";
import { fetchLegacyActivity } from "./legacy/fetchActivity";
import { fetchTreasuryData } from "./treasury/fetchTreasury";
import { refreshTreasuryData } from "./treasury/refreshTreasury";
import { fetchHistoricalTreasuryChart } from "../chart/databaseCharts";

// /dao/<ROUTER>
const router = Router();

router.get("/:dao", fetchDao);
router.get("/all", fetchDaosPreview);
router.get("/legacy/activity/:dao", fetchLegacyActivity)

router.get("/treasury/:daoName", fetchTreasuryData);
router.post("/treasury/refresh/:daoName", refreshTreasuryData);

router.get("/treasury/historical/:daoName", fetchHistoricalTreasuryChart);

export default router;
