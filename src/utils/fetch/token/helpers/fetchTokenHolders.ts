import { ethers } from "ethers";
import type { Address } from "viem";
import { erc20Abi, formatUnits } from "viem";
import z from "zod";

import type { TokenHoldersDocument } from "../../../../config/models/tokenHoldersSchema";
import TokenHoldersModel from "../../../../config/models/tokenHoldersSchema";
import { logErrorEmbed } from "../../../../utils/coms/logAction";
import { ENV } from "../../../../utils/env";
import type { Holder } from "../tokenStats";

import type { TopHolder } from "@/config/models/tokenSchema";
import { sleep } from "@/utils/utils";


const TransferArgsSchema = z.tuple([
  z.string(), // from
  z.string(), // to
  z.bigint(), // value
]);

interface TransferEventArgs {
  from: string;
  to: string;
  value: ethers.BigNumberish;
}

interface FetchHoldersResponse {
  totalSupply: number;
  allHolders: Holder[];
  topHoldersProportion: number;
  topHolders: TopHolder[];
}

export default async function fetchTokenHolders(
  tokenAddress: Address,
  initialBlock: number
): Promise<FetchHoldersResponse | null> {
  const batchSize = 50_000; // Process events in batches of 50,000
  const minBalanceThreshold = 0.01; // Only include accounts with >0.01 tokens

  try {
    const provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${ENV.INFURA_KEY}`);
    if (!provider) throw new Error(`Couldn't initialize provider contract in fetchHolders`);

    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    if (!tokenContract) throw new Error(`Couldn't initialize token contract in fetchHolders`);

    // Get total supply and format it
    const [totalSupply, decimals, tokenHoldersEntry]: [
      bigint,
      bigint,
      TokenHoldersDocument | null,
    ] = await Promise.all([
      await tokenContract.totalSupply(),
      await tokenContract.decimals(),
      await TokenHoldersModel.findByTokenAddress(tokenAddress),
    ]);

    const parsedTotalSupply = Math.round(parseFloat(formatUnits(totalSupply, Number(decimals))));

    const currentBlock = await provider.getBlockNumber();

    const holders: Map<string, number> = new Map();
    let startBlock = initialBlock;

    if (tokenHoldersEntry) {
      startBlock = tokenHoldersEntry.last_block_fetched;
      tokenHoldersEntry.holders.forEach((holder) => holders.set(holder.address, holder.balance));
    }

    for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += batchSize) {
      try {
        const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
        console.log(`Fetching events from block ${fromBlock} to ${toBlock}...`);

        await sleep(500);

        const events = await tokenContract.queryFilter(
          tokenContract.filters.Transfer(),
          fromBlock,
          toBlock
        );

        for (const event of events) {
          try {
            if (!("args" in event && event.args))
              throw new Error(`Skipping event without args: ${JSON.stringify(event)}`);

            const transferEvent = event.args as unknown as TransferEventArgs;
            TransferArgsSchema.parse(transferEvent);

            const from = transferEvent.from;
            const to = transferEvent.to;
            const value = parseFloat(ethers.formatUnits(transferEvent.value, Number(decimals)));

            if (!holders.has(from)) holders.set(from, 0);
            if (!holders.has(to)) holders.set(to, 0);

            holders.set(from, (holders.get(from) || 0) - value);
            holders.set(to, (holders.get(to) || 0) + value);
          } catch (err) {
            await logErrorEmbed(`Error in event block batching child fetchHolders: ${err}`);
            continue;
          }
        }
      } catch (err) {
        await logErrorEmbed(`Error in event block batching parent fetchHolders: ${err}`);
        continue;
      }
    }

    // Filter holders and sort by balance
    const filteredHolders: [string, number][] = Array.from(holders.entries())
      .filter(([_, balance]) => balance > minBalanceThreshold)
      .sort((a, b) => b[1] - a[1]);

    if (filteredHolders.length === 0) throw new Error("No token holders found");

    const holdersArray = filteredHolders.map(([address, balance]) => ({
      address,
      balance,
    }));

    const constructedEntry = {
      token_address: tokenAddress.toLowerCase(),
      initial_block_fetched: tokenHoldersEntry
        ? tokenHoldersEntry.initial_block_fetched
        : initialBlock,
      last_block_fetched: currentBlock,
      holders: holdersArray,
    };

    await TokenHoldersModel.updateOne(
      { token_address: tokenAddress.toLowerCase() },
      { $set: constructedEntry },
      { upsert: true }
    );

    // Get top 10 holders and identify wallet/contract
    const topHolders: TopHolder[] = await Promise.all(
      filteredHolders.slice(0, 10).map(async ([address, token_amount]) => {
        try {
          const code = await provider.getCode(address);
          const type = code !== "0x" ? "contract" : "wallet";
          return {
            address,
            token_amount,
            account_type: type,
          };
        } catch (err) {
          console.error(`Error fetching code for address ${address}: ${err}`);
          return {
            address,
            token_amount,
            account_type: "unknown",
          };
        }
      })
    );

    // Calculate the proportion of tokens held by the top 10 holders
    const totalTopHoldersBalance = topHolders.reduce((sum, holder) => sum + holder.token_amount, 0);
    const topHoldersProportion =
      totalSupply > 0 ? (totalTopHoldersBalance / parsedTotalSupply) * 100 : 0;

    return {
      totalSupply: parsedTotalSupply,
      allHolders: holdersArray,
      topHoldersProportion: Number(topHoldersProportion.toFixed(2)),
      topHolders,
    };
  } catch (err) {
    await logErrorEmbed(`Error in parent fetchHolders function: ${err}`);
    return null;
  }
}
