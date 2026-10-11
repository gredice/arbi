export interface CameraAdapter { initialize():Promise<{ready:boolean;origin:'simulated'|'unavailable'}>; shutdown():Promise<void>; }
export interface GimbalAdapter { inhibit():void; }
/** No physical camera, servo access, sweep, autofocus or capture is performed. */
export function unavailableAdapters():{camera:CameraAdapter;gimbal:GimbalAdapter} {
  return {camera:{initialize:async()=>({ready:false,origin:'unavailable'}),shutdown:async()=>{}},gimbal:{inhibit:()=>{}}};
}
