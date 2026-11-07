import { useCallback,useEffect,useRef,useState } from 'react';
import { api } from '../api.js';
// One promise per mounted account also handles React StrictMode's effect replay.
// A failed/ambiguous claim never starts a tour; the server owns once-only state.
export function useDashboardTour(ghId:string|undefined,ready:boolean) {
 const pending=useRef<{ghId:string;request:Promise<boolean>;presented:boolean}|null>(null);
 const [owner,setOwner]=useState<string|null>(null);
 const stop=useCallback(()=>{setOwner(null);},[]);
 useEffect(()=>{
  if(!ghId||!ready){setOwner(null);return;}
  if(pending.current?.ghId!==ghId){
   const request=api.dashboardTour().then(async state=>state.seen?false:(await api.claimDashboardTour(state.csrf)).show).catch(()=>false);
   pending.current={ghId,request,presented:false};
  }
  let active=true;const entry=pending.current;
  void entry.request.then(show=>{if(active&&show&&!entry.presented){entry.presented=true;setOwner(ghId);}});
  return ()=>{active=false;};
 },[ghId,ready]);
 return {run:ready&&owner===ghId&&Boolean(ghId),stop};
}
