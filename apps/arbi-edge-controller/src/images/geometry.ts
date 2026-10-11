import type { Calibration,Point } from './contracts.js';
import { fail } from './png.js';
export function distort(p: Point,i: Calibration['intrinsics']): Point {
  const r=p.x*p.x+p.y*p.y,radial=1+i.k1*r+i.k2*r*r;
  return {x:p.x*radial+2*i.p1*p.x*p.y+i.p2*(r+2*p.x*p.x),y:p.y*radial+i.p1*(r+2*p.y*p.y)+2*i.p2*p.x*p.y};
}
export function undistort(pixel: Point,i: Calibration['intrinsics'],work: (n:number)=>void): Point {
  const observed={x:(pixel.x-i.cx)/i.fx,y:(pixel.y-i.cy)/i.fy};let p={...observed};
  for(let n=0;n<24;n++) {
    work(1);const d=distort(p,i),dx=observed.x-d.x,dy=observed.y-d.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<1e-9)return p;
    p={x:p.x+dx,y:p.y+dy};if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.max(Math.abs(p.x),Math.abs(p.y))>4)fail('LENS_INVERSION_FAILED');
  }
  return fail('LENS_INVERSION_FAILED');
}
export function convex(points: Point[]): void {
  let sign=0,area=0;
  for(let n=0;n<4;n++) {
    const a=points[n],b=points[(n+1)%4],c=points[(n+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(!Number.isFinite(cross)||Math.abs(cross)<1e-6||(sign&&Math.sign(cross)!==sign))fail('FIDUCIAL_GEOMETRY');sign=Math.sign(cross);area+=a.x*b.y-b.x*a.y;
  }
  if(Math.abs(area)<1e-4)fail('FIDUCIAL_GEOMETRY');
}
/** Four correspondences, normalized coordinates and partial pivoting. */
export function homography(from: Point[],to: Point[]): number[] {
  convex(from);convex(to);const rows:number[][]=[];
  for(let n=0;n<4;n++) {const {x,y}=from[n],u=to[n].x,v=to[n].y;rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
  for(let column=0;column<8;column++) {
    let pivot=column;for(let row=column+1;row<8;row++)if(Math.abs(rows[row][column])>Math.abs(rows[pivot][column]))pivot=row;
    [rows[pivot],rows[column]]=[rows[column],rows[pivot]];const divisor=rows[column][column];if(Math.abs(divisor)<1e-9)fail('FIDUCIAL_GEOMETRY');
    for(let k=column;k<9;k++)rows[column][k]/=divisor;
    for(let row=0;row<8;row++)if(row!==column) {const scale=rows[row][column];for(let k=column;k<9;k++)rows[row][k]-=scale*rows[column][k];}
  }
  const h=rows.map(r=>r[8]);h.push(1);if(h.some(v=>!Number.isFinite(v)||Math.abs(v)>1e6))fail('FIDUCIAL_GEOMETRY');return h;
}
export function project(h:number[],p:Point):Point {
  const denominator=h[6]*p.x+h[7]*p.y+1;if(!Number.isFinite(denominator)||Math.abs(denominator)<1e-6)fail('FIDUCIAL_GEOMETRY');
  return {x:(h[0]*p.x+h[1]*p.y+h[2])/denominator,y:(h[3]*p.x+h[4]*p.y+h[5])/denominator};
}
