import { logErrorEmbed } from "../../../../utils/coms/logAction";
import { Holder } from "../tokenStats";

export interface PercentileStat {
  range: string;
  accounts: number;
  percent_tokens_held: number;
  amount_tokens_held: string;
}

interface CalculateStatsResponse {
  totalHolders: number;
  averageBalance: number;
  medianBalance: number;
  groupStats: PercentileStat[];
}

const walletGroups: {
  percentage: number;
  rangeStart: number;
  rangeEnd: number;
}[] = [
  { percentage: 10, rangeStart: 0, rangeEnd: 10 },
  { percentage: 25, rangeStart: 10, rangeEnd: 25 },
  { percentage: 50, rangeStart: 25, rangeEnd: 50 },
  { percentage: 80, rangeStart: 50, rangeEnd: 80 },
];

export default function calculateTokenDistribution(holdersArray: Holder[], totalSupply: number): CalculateStatsResponse | null {
  try {
    const totalHolders = holdersArray.length;
    const averageBalance = totalHolders > 0 ? totalSupply / totalHolders : 0;

    // Group stats for each percentage range
    const groupStats: PercentileStat[] = walletGroups.map(
      ({ rangeStart, rangeEnd }) => {

        const rangeStartIndex = Math.floor((rangeStart / 100) * totalHolders);
        const rangeEndIndex = Math.floor((rangeEnd / 100) * totalHolders);
        const walletsInRange = holdersArray.slice(rangeStartIndex, rangeEndIndex);

        const cumulativeBalance = walletsInRange.reduce(
          (total, { balance }) => total + balance,
          0
        );
        // percent of supply held by wallets in range of the lower and upper bound
        const percent_tokens_held =
          totalSupply > 0 ? (cumulativeBalance / totalSupply) * 100 : 0;

        return {
          range: `${rangeStart}-${rangeEnd}%`,
          accounts: walletsInRange.length,
          percent_tokens_held,
          amount_tokens_held: cumulativeBalance.toFixed(2),
        };
      }
    );

    // Median balance calculation
    const middleIndex = Math.floor(totalHolders / 2);
    let medianBalance: number = 0;
    if (totalHolders !== 0) {
      if (totalHolders % 2 === 0) {
        // if token holders is a even number that is not 0 average the two middle values possible simplify in future
        medianBalance =
          (holdersArray[middleIndex - 1].balance +
            holdersArray[middleIndex].balance) /
          2;
      } else {
        medianBalance = holdersArray[middleIndex].balance;
      }
    }

    return {
      totalHolders,
      averageBalance: Number(averageBalance.toFixed(2)),
      medianBalance: Number(medianBalance.toFixed(2)),
      groupStats,
    };
  } catch (err) {
    logErrorEmbed(`Error calculating token stats: ${err}`); // fire and forget, should never run in theory errors should be caught earlier
    return null;
  }
}