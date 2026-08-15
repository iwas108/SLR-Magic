/**
 * Pure Largest Remainder Method (Hare-Hamilton quota balancing) to guarantee
 * exact 100.00% sum without floating-point rounding drift.
 */

export interface QuotaBalanceInput {
  name: string;
  count: number;
}

export interface QuotaBalanceOutput {
  name: string;
  count: number;
  rawPct: number;
  floorPct: number;
  remainder: number;
  finalPct: number;
}

export function balanceQuotasToHundred(
  items: QuotaBalanceInput[], 
  totalItems: number
): Map<string, number> {
  const balancedMap = new Map<string, number>();
  if (totalItems <= 0 || items.length === 0) {
    items.forEach(it => balancedMap.set(it.name, 0));
    return balancedMap;
  }

  const quotaItems: QuotaBalanceOutput[] = items.map(it => {
    const rawPct = (it.count / totalItems) * 100;
    const floorPct = Math.floor(rawPct * 100) / 100;
    const remainder = rawPct - floorPct;
    return {
      name: it.name,
      count: it.count,
      rawPct,
      floorPct,
      remainder,
      finalPct: floorPct
    };
  });

  const currentSumCents = Math.round(quotaItems.reduce((acc, it) => acc + it.floorPct * 100, 0));
  const diffCents = 10000 - currentSumCents; // target 100.00% = 10000 cents

  if (diffCents > 0 && diffCents <= quotaItems.length) {
    const sortedByRemainder = [...quotaItems].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < diffCents; i++) {
      sortedByRemainder[i].finalPct = Math.round((sortedByRemainder[i].finalPct + 0.01) * 100) / 100;
    }
  }

  quotaItems.forEach(it => {
    balancedMap.set(it.name, it.finalPct);
  });

  return balancedMap;
}
