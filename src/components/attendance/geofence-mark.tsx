const SIZE = 104;
const CENTER = SIZE / 2;
const RING = 48;

/**
 * Where a scan was taken against the office geofence: the ring is the
 * allowed radius, the dot the reported position, the halo its accuracy.
 * Drawn to scale; a position outside the radius sits on the edge.
 */
export function GeofenceMark({
  distanceM,
  radiusM,
  accuracyM,
  accepted,
}: {
  distanceM: number;
  radiusM: number;
  accuracyM: number;
  accepted: boolean;
}) {
  const inside = distanceM <= radiusM;
  const offset = Math.min((distanceM / radiusM) * RING, CENTER - 4) / Math.SQRT2;
  const halo = Math.min((accuracyM / radiusM) * RING, RING);
  const x = CENTER + offset;
  const y = CENTER - offset;
  const tone = accepted ? "fill-settled" : "fill-negative";

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Scan location ${Math.round(distanceM)} metres from the office centre, ${inside ? "inside" : "outside"} the ${Math.round(radiusM)} metre radius, accurate to ${Math.round(accuracyM)} metres`}
      className="shrink-0"
    >
      <circle cx={CENTER} cy={CENTER} r={RING} className="fill-pend-bg stroke-pend" strokeWidth="1.5" />
      <circle cx={CENTER} cy={CENTER} r="3" className="fill-pend" />
      <circle cx={x} cy={y} r={halo} className={tone} fillOpacity="0.18" />
      <circle cx={x} cy={y} r="4" className={tone} />
    </svg>
  );
}
