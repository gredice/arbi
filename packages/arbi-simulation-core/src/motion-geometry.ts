import { configurationDigest, validateConfigurationRecord, type Configuration, type VectorMm } from "@arbi/protocol";

export interface AxisMechanics {
  radiusMm: number; fullStepsPerTurn: number; microsteps: number; direction: number;
  homeCableMm: number; homeSteps: number; minimumCableMm: number; maximumCableMm: number;
  minimumSteps: number; maximumSteps: number; maximumRateHz: number; maximumAccelerationHzPerS: number;
}
export interface MotionProfile {
  identity: { site: string; configuration: string; hardware: string; calibration: string; geometry: string; frame: string; binding: string };
  anchors: VectorMm[]; offsetsMm: number[]; axes: AxisMechanics[];
  minimumMm: VectorMm; maximumMm: VectorMm; maximumSpeedMmPerS: number; maximumAccelerationMmPerS2: number;
}
const xyz = (p: VectorMm): number[] => [p.x, p.y, p.z];
const finite = (n: number): boolean => Number.isFinite(n) && Math.abs(n) <= 1e7;
const integer = (n: number): boolean => Number.isInteger(n) && n >= -2147483647 && n <= 2147483647;
export function validateMotionProfile(p: MotionProfile): void {
  if (Object.values(p.identity).some(v => typeof v !== "string" || !/^[a-zA-Z0-9_.-]{1,64}$/u.test(v))
    || p.anchors.length !== 4 || p.offsetsMm.length !== 4 || p.axes.length !== 4
    || [...p.anchors.flatMap(xyz), ...xyz(p.minimumMm), ...xyz(p.maximumMm), ...p.offsetsMm].some(n => !finite(n))
    || !finite(p.maximumSpeedMmPerS) || p.maximumSpeedMmPerS <= 0 || p.maximumSpeedMmPerS > 50
    || !finite(p.maximumAccelerationMmPerS2) || p.maximumAccelerationMmPerS2 <= 0 || p.maximumAccelerationMmPerS2 > 100) throw new Error("INVALID_PROFILE");
  // Deliberately narrow model: ordered a/b/c/d rectangular coplanar anchors.
  const [a,b,c,d] = p.anchors;
  if (!(b.x-a.x >= 1 && d.y-a.y >= 1 && b.y === a.y && d.x === a.x && c.x === b.x && c.y === d.y)
    || p.anchors.some(v => v.z !== a.z) || p.maximumMm.z >= a.z
    || xyz(p.minimumMm).some((n,i) => n >= xyz(p.maximumMm)[i])) throw new Error("UNSUPPORTED_GEOMETRY");
  for (const v of p.axes) {
    if ([v.radiusMm,v.fullStepsPerTurn,v.microsteps,v.direction,v.homeCableMm,v.homeSteps,v.minimumCableMm,v.maximumCableMm,
      v.minimumSteps,v.maximumSteps,v.maximumRateHz,v.maximumAccelerationHzPerS].some(n => !finite(n)) || v.radiusMm < 1 || v.radiusMm > 1000
      || !integer(v.fullStepsPerTurn) || v.fullStepsPerTurn < 1 || v.fullStepsPerTurn > 10000
      || ![1,2,4,8,16,32,64,128,256].includes(v.microsteps) || ![-1,1].includes(v.direction)
      || !integer(v.homeSteps) || !integer(v.minimumSteps) || !integer(v.maximumSteps)
      || v.minimumSteps >= v.maximumSteps || v.homeSteps < v.minimumSteps || v.homeSteps > v.maximumSteps
      || v.minimumCableMm <= 0 || v.minimumCableMm >= v.maximumCableMm || v.maximumCableMm > 1e7
      || v.homeCableMm < v.minimumCableMm || v.homeCableMm > v.maximumCableMm
      || v.maximumRateHz <= 0 || v.maximumRateHz > 20000
      || v.maximumAccelerationHzPerS < 100 || v.maximumAccelerationHzPerS > 2000000) throw new Error("INVALID_AXIS");
  }
}
/** Derive geometry and revisions from the shared admitted configuration. Mechanics are a separate trusted model input, never a command field. */
export function motionProfile(configuration: Configuration, axes: AxisMechanics[]): MotionProfile {
  if (!validateConfigurationRecord(configuration, "configuration").ok || configuration.executionMode !== "simulation"
    || configuration.geometry.siteFrame.name !== "site" || configuration.realm.environment !== "test" || configuration.calibration?.scope !== "simulation") throw new Error("ISOLATED_PROFILE_ONLY");
  const c = configuration, cal = c.calibration!;
  const profile: MotionProfile = {
    identity: { site:c.siteId, configuration:configurationDigest(c), hardware:cal.hardwareDigest,
      calibration:cal.revision, geometry:c.geometry.revision, frame:c.geometry.siteFrame.revision,
      binding:configurationDigest({ configuration:configurationDigest(c), axes }) },
    anchors:["a","b","c","d"].map(line => c.geometry.anchors.find(a => a.line === line)!.positionMm),
    offsetsMm:[cal.lineLengthOffsetsMm.a,cal.lineLengthOffsetsMm.b,cal.lineLengthOffsetsMm.c,cal.lineLengthOffsetsMm.d],
    axes:structuredClone(axes), minimumMm:c.limits.workspace.minMm, maximumMm:c.limits.workspace.maxMm,
    maximumSpeedMmPerS:c.limits.maxSpeedMmPerS, maximumAccelerationMmPerS2:c.limits.maxAccelerationMmPerS2,
  };
  validateMotionProfile(profile); return structuredClone(profile);
}
export function mmPerStep(a: AxisMechanics): number { return 2 * Math.PI * a.radiusMm / (a.fullStepsPerTurn * a.microsteps); }
function roundAway(n: number): number { return n < 0 ? -Math.floor(-n + 0.5) : Math.floor(n + 0.5); }
export function poseToCounts(p: MotionProfile, positionMm: VectorMm): { cableMm: number[]; counts: number[] } {
  validateMotionProfile(p);
  if (xyz(positionMm).some((n,i) => !finite(n) || n < xyz(p.minimumMm)[i] || n > xyz(p.maximumMm)[i])) throw new Error("OUTSIDE_WORKSPACE");
  const cableMm = p.anchors.map((a,i) => Math.hypot(a.x-positionMm.x,a.y-positionMm.y,a.z-positionMm.z) + p.offsetsMm[i]);
  const counts = cableMm.map((length,i) => {
    const a = p.axes[i], n = a.homeSteps + roundAway((length-a.homeCableMm) / mmPerStep(a)) * a.direction;
    if (length < a.minimumCableMm || length > a.maximumCableMm || !integer(n) || n < a.minimumSteps || n > a.maximumSteps) throw new Error("OUTSIDE_TRAVEL");
    return n;
  });
  return { cableMm, counts };
}
/** Four sphere residuals are checked; this estimate uses the branch below the anchor plane and includes quantization only. */
export function countsToPose(p: MotionProfile, counts: number[]): { positionMm: VectorMm; cableMm: number[] } {
  validateMotionProfile(p);
  if (counts.length !== 4) throw new Error("INVALID_COUNTS");
  const cableMm = counts.map((n,i) => {
    const a = p.axes[i];
    if (!integer(n) || n < a.minimumSteps || n > a.maximumSteps) throw new Error("OUTSIDE_TRAVEL");
    const length = a.homeCableMm + (n-a.homeSteps) * a.direction * mmPerStep(a);
    if (!finite(length) || length < a.minimumCableMm || length > a.maximumCableMm) throw new Error("OUTSIDE_TRAVEL");
    return length;
  });
  const l = cableMm.map((v,i) => v-p.offsetsMm[i]), [a,b,,d] = p.anchors;
  if (l.some(n => n <= 0)) throw new Error("INCONSISTENT_CABLES");
  const width = b.x-a.x, depth = d.y-a.y;
  const x = (l[0]**2-l[1]**2+width**2)/(2*width), y = (l[0]**2-l[3]**2+depth**2)/(2*depth);
  const squared = l[0]**2-x*x-y*y;
  if (!Number.isFinite(squared) || squared <= 0) throw new Error("INCONSISTENT_CABLES");
  const positionMm = {x:a.x+x,y:a.y+y,z:a.z-Math.sqrt(squared)};
  if (xyz(positionMm).some((n,i) => !finite(n) || n < xyz(p.minimumMm)[i] || n > xyz(p.maximumMm)[i])) throw new Error("OUTSIDE_WORKSPACE");
  const tolerance = 4 * Math.max(...p.axes.map(mmPerStep));
  if (p.anchors.some((v,i) => Math.abs(Math.hypot(v.x-positionMm.x,v.y-positionMm.y,v.z-positionMm.z)-l[i]) > tolerance)) throw new Error("INCONSISTENT_CABLES");
  return {positionMm,cableMm};
}
