/**
 * RVP weighted average calculation engine.
 * Formula matches the Excel template Row 61 / Row 110 logic.
 */
export function calcClosingRVP({ openingRVP, openingVolume, heel, receipts }) {
  // receipts: [{ volume, rvp }]
  const numerator =
    openingRVP * openingVolume +
    openingRVP * heel +
    receipts.reduce((sum, r) => sum + r.rvp * r.volume, 0);
  const denominator =
    openingVolume + heel + receipts.reduce((sum, r) => sum + r.volume, 0);
  return denominator > 0 ? numerator / denominator : openingRVP;
}
