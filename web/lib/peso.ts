// Demo rate: PHP 1,000,000 = 0.1 tBNB, so PHP 1 = 1e11 wei. Convert at the edges only;
// the UI always shows pesos.
export const WEI_PER_PESO = 100_000_000_000n;

export function pesoToWei(php: number): bigint {
  return BigInt(Math.round(php)) * WEI_PER_PESO;
}

export function weiToPeso(wei: bigint | string): number {
  return Number(BigInt(wei) / WEI_PER_PESO);
}

export function peso(n: number): string {
  return "₱" + Math.round(n).toLocaleString("en-US");
}

export function short(h: string): string {
  return h.length > 12 ? h.slice(0, 6) + "…" + h.slice(-4) : h;
}
