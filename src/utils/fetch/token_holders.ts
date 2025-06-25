import { ethers } from 'ethers';

// Interface for event arguments
interface TransferEventArgs {
  from: string;
  to: string;
  value: ethers.BigNumberish;
}

// Interface for the event itself
interface TransferEvent {
  args: TransferEventArgs;
  transactionHash: string;
}

// Set up the provider (Infura or Alchemy endpoint)
const infuraKey: string | undefined = process.env.INFURA_KEY;

// Function to fetch the number of current holders
async function getCurrentHolders(
  tokenAddress: string,
  tokenABI: any[], // Using any[] as ABI can vary; consider using ethers.ContractInterface for stricter typing
  startBlock: number,
  decimals: number
): Promise<number> {
  try {
    if (!tokenAddress || !tokenABI || !startBlock || decimals === undefined) {
      throw new Error('Invalid function arguments. Please provide tokenAddress, tokenABI, startBlock, and decimals.');
    }

    let provider: ethers.JsonRpcProvider;
    try {
      if (!infuraKey) {
        throw new Error('Infura key not provided');
      }
      provider = new ethers.JsonRpcProvider(`https://mainnet.infura.io/v3/${infuraKey}`);
    } catch (error: any) {
      console.error(`Error initializing provider: ${error.message}`);
      return 0; // Return zero to avoid breaking the app
    }

    let tokenContract: ethers.Contract;
    try {
      tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);
    } catch (error: any) {
      console.error(`Error creating contract instance for ${tokenAddress}: ${error.message}`);
      return 0; // Return zero to avoid breaking the app
    }

    const holders: Map<string, number> = new Map();
    const batchSize: number = 1000000; // Define batch size (1,000,000 blocks)

    try {
      // Define block range
      const endBlock: number = await provider.getBlockNumber();

      for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += batchSize) {
        const toBlock: number = Math.min(fromBlock + batchSize - 1, endBlock);

        console.log(`Fetching events from block ${fromBlock} to ${toBlock}...`);

        // Fetch Transfer events for the current batch
        const events = await tokenContract.queryFilter(
          tokenContract.filters.Transfer(),
          fromBlock,
          toBlock
        );

        if (!Array.isArray(events) || events.length === 0) {
          console.warn(`No transfer events found from block ${fromBlock} to ${toBlock}.`);
          continue; // Skip empty batches
        }

        // Process events with type safety
        for (const event of events) {
          // Check if event is an EventLog with args
          if ('args' in event && event.args) {
            const transferEvent = event as unknown as TransferEvent;
            if (
              !transferEvent.args?.from ||
              !transferEvent.args.to ||
              !transferEvent.args.value
            ) {
              console.warn(`Warning: Skipping malformed event: ${JSON.stringify(event)}`);
              continue;
            }

            const from: string = transferEvent.args.from;
            const to: string = transferEvent.args.to;

            let value: number;
            try {
              value = parseFloat(ethers.formatUnits(transferEvent.args.value, decimals));
            } catch (error: any) {
              console.warn(
                `Warning: Error parsing value for event ${transferEvent.transactionHash}: ${error.message}`
              );
              continue;
            }

            if (!holders.has(from)) holders.set(from, 0);
            if (!holders.has(to)) holders.set(to, 0);

            holders.set(from, (holders.get(from) || 0) - value);
            holders.set(to, (holders.get(to) || 0) + value);
          } else {
            console.warn(`Warning: Skipping event without args: ${JSON.stringify(event)}`);
            continue;
          }
        }
      }

      // Filter out holders with balance <= 0
      const currentHoldersCount: number = Array.from(holders.values()).filter(
        (balance) => balance > 0.01
      ).length;

      return currentHoldersCount;
    } catch (error: any) {
      console.error(`Error fetching events for token ${tokenAddress}: ${error.message}`);
      return 0; // Return zero in case of errors
    }
  } catch (err: any) {
    console.error(`Error fetching current holders: ${err.message}`);
    return 0;
  }
}

export default getCurrentHolders;