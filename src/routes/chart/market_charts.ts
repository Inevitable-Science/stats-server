// src/routes/chart.ts
import { Router, Request, Response } from "express";
import axios, { AxiosResponse } from "axios";
import NodeCache from "node-cache";
import { daos, DAO } from "../../config/constants";

// Cache instances
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });
const cache404 = new NodeCache({ stdTTL: 120 });

// Allowed days for the API query
const ALLOWED_DAYS = ["1", "7", "30", "365", "max"];

const router = Router();

router.get("/:query", async (req: Request, res: Response): Promise<void> => {
  const { query } = req.params;

  // Parse query parameter (expected format: id-days, e.g., cryodao-7)
  const [id, days] = query.split("-");

  // Validate `id` and `days` parameters
  if (!id || !days) {
    res
      .status(400)
      .json({
        error:
          "Invalid query format. Expected format: id-days (e.g., cryodao-7)",
      });
    return;
  }

  if (!ALLOWED_DAYS.includes(days)) {
    res.status(400).json({
      error: `Invalid 'days' parameter. Allowed values are: ${ALLOWED_DAYS.join(", ")}`,
    });
    return;
  }

  // Find matching DAO
  const daoMatch = daos.find((d: DAO) => {
    if (d.native_token.name.toLowerCase() === id.toLowerCase()) {
      return true;
    } else if (d.native_token.mc_ticker.toLowerCase() === id.toLowerCase()) {
      return true;
    }

    if (d.ipt) {
      return Object.keys(d.ipt).some(
        (key) =>
          d.ipt![key].name.toLowerCase() === id.toLowerCase() &&
          d.ipt![key].token_type === "ERC-20"
      );
    }

    return false;
  });

  if (!daoMatch) {
    res.status(404).json({ error: `No DAO or IPT found matching id: ${id}` });
    return;
  }

  // Extract tokenName
  let tokenName: string | undefined;

  if (
    daoMatch.native_token.name.toLowerCase() === id.toLowerCase() ||
    daoMatch.native_token.mc_ticker.toLowerCase() === id.toLowerCase()
  ) {
    tokenName = daoMatch.native_token.mc_ticker;
  } else if (daoMatch.ipt) {
    const matchingIptKey = Object.keys(daoMatch.ipt).find(
      (key) =>
        daoMatch.ipt![key].name.toLowerCase() === id.toLowerCase() &&
        daoMatch.ipt![key].token_type === "ERC-20"
    );

    if (matchingIptKey) {
      tokenName = daoMatch.ipt[matchingIptKey].mc_ticker;
    }
  }

  if (!tokenName) {
    res.status(404).json({ error: `No token found for id: ${id}` });
    return;
  }

  try {
    // Check for cached 404 response
    const cacheKey404 = `${id}-${days}-market-404`;
    const cached404 = cache404.get(cacheKey404);

    if (cached404) {
      console.log("Serving cached 404 response");
      res.status(404).json(cached404);
      return;
    }

    // Check cache for data
    const cacheKey = `${id}-${days}-market`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      console.log("Serving from cache:", cacheKey);
      res.json(cachedData);
      return;
    }

    // Use static CoinGecko API URL
    const apiUrl = `https://api.coingecko.com/api/v3/coins/${tokenName}/market_chart?vs_currency=usd&days=${days}`;

    console.log(`Fetching data from API: ${apiUrl}`);

    const response: AxiosResponse = await axios.get(apiUrl);

    // Cache successful response
    if (response.status >= 200 && response.status < 300) {
      cache.set(cacheKey, response.data);
    }

    res.json(response.data);
  } catch (error: any) {
    console.error("Error fetching data:", error.message);

    // Handle 404 errors
    if (error.response && error.response.status === 404) {
      const cacheKey404 = `${id}-${days}-market-404`;
      const cached404 = { error: `Data not found for ${id} with ${days} days` };

      cache404.set(cacheKey404, cached404);
      res.status(404).json(cached404);
      return;
    }

    // Handle other errors
    res.status(500).json({ error: "Failed to fetch data from external API" });
  }
});

export default router;
