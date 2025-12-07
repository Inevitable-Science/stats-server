import type { Request, Response } from "express";
import NodeCache from "node-cache";
import z from "zod";

import { daos } from "../../../config/constants";
import { logErrorEmbed } from "../../../utils/coms/logAction";
import { ErrorCodes } from "../../../utils/errors";

// Cache instances
const cache = new NodeCache({ stdTTL: 600, checkperiod: 60 }); // live for 10 min, checked every 60 seconds
const cacheNotFound = new NodeCache({ stdTTL: 120 });

// Allowed days for the API query
const ALLOWED_DAYS = ["1", "7", "30", "365", "max"];
const ALLOWED_CHARTS = ["market_chart", "ohlc"];

const OHLCResponseZ = z.array(
  z.tuple([
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
  ])
);

const MarketChartResponseZ = z.object({
  prices: z.array(
    z.tuple([
      z.number(),
      z.number(),
    ])
  ),
  market_caps: z.array(
    z.tuple([
      z.number(),
      z.number(),
    ])
  ),
  total_volumes: z.array(
    z.tuple([
      z.number(),
      z.number(),
    ])
  ),
});

const ParamsSchemaZ = z.object({
  chartType: z.string().nonempty().transform((val) => val.toLowerCase()),
  tokenName: z.string().nonempty().transform((val) => val.toLowerCase()),
  timeFrame: z.string().nonempty().transform((val) => val.toLowerCase()),
});

export async function fetchExternalChart(req: Request, res: Response): Promise<void> {
  try {
    const parsedParams = ParamsSchemaZ.parse(req.params);
    const { chartType, tokenName, timeFrame } = parsedParams;

    if (!chartType || !tokenName || !timeFrame) {
      res.status(400).json({ error: ErrorCodes.BAD_REQUEST });
      return;
    }

    if (
      !ALLOWED_DAYS.includes(timeFrame) ||
      !ALLOWED_CHARTS.includes(chartType)
    ) {
      res.status(400).json({
        error: ErrorCodes.BAD_REQUEST,
      });
      return;
    }

    const foundDao = daos.find(dao => 
      dao.name.toLowerCase() === tokenName.toLowerCase() ||
      dao.native_token.name.toLowerCase() === tokenName.toLowerCase() ||
      dao.native_token.mc_ticker.toLowerCase() === tokenName.toLowerCase()
    );

    if (!foundDao) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    const tokenTicker = foundDao.native_token.mc_ticker; // TODO: make this field optional if dao does not have coin gecko listing
    if (!tokenTicker) {
      res.status(404).json({ error: ErrorCodes.ELEMENT_NOT_FOUND });
      return;
    }

    // Check for cached 404 response
    const cacheKeyNotFound = `${tokenTicker}-${timeFrame}-${chartType}-404`;
    const cachedNotFound = cacheNotFound.get(cacheKeyNotFound);

    if (cachedNotFound) {
      console.log("Serving cached 404 response");
      res.status(404).json(cachedNotFound);
      return;
    }

    // Check cache for data
    const cacheKey = `${tokenTicker}-${timeFrame}-${chartType}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      console.log("Serving from cache:", cacheKey);
      res.json(cachedData);
      return;
    }

    // Use static CoinGecko API URL
    // - 'max' timeframe is not allowed here need paid plan
    const COIN_GECKO_ENDPOINT = `https://api.coingecko.com/api/v3/coins/${tokenTicker}/${chartType}?vs_currency=usd&days=${timeFrame}`;
    console.log(`Fetching data from API: ${COIN_GECKO_ENDPOINT}`);

    const response = await fetch(COIN_GECKO_ENDPOINT);
    
    if (!response.ok) {
      console.error("Error fetching external chart");

      // Handle 404 & 429 errors
      if (response.status === 404 || response.status === 429) {
        const cachedNotFoundData = { error: `External ${chartType} data not found for ${tokenName} with for ${timeFrame}` };

        cacheNotFound.set(cacheKeyNotFound, cachedNotFoundData);
        res.status(404).json(cachedNotFoundData);
        return;
      }

      // Handle other errors
      res.status(response.status).json({ error: ErrorCodes.BAD_REQUEST });
      return;
    }

    const data = await response.json();

    let parsed;
    if (chartType === "ohlc") {
      parsed = OHLCResponseZ.parse(data);
    } else {
      parsed = MarketChartResponseZ.parse(data);
    }

    cache.set(cacheKey, parsed);
    res.json(parsed);

  } catch (err) {
    await logErrorEmbed(`Error serving external chart: ${err}`);
    res.status(500).json({ error: ErrorCodes.BAD_REQUEST });
    return;
  }
};