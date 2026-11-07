import { useEffect,useMemo,useRef,useState } from 'react';
import { Joyride,type EventData } from 'react-joyride';
import { useAuth } from '../../context/AuthContext.js';
import { useWorkspaceData } from '../../context/WorkspaceDataContext.js';
import { useRouter } from '../../router/Router.js';
import { useDashboardTour } from '../../hooks/useDashboardTour.js';
import { TourReadyContext,TourTooltip } from './TourTooltip.js';
import { dashboardTourSteps } from './dashboardTourSteps.js';
export function DashboardTour({closeNavigation}:{closeNavigation:()=>void}) {
 const {user}=useAuth();const {initialLoading,error,selectedBountyId}=useWorkspaceData();
 const {navigate}=useRouter();
 const {run,stop}=useDashboardTour(user?.id,!initialLoading&&!error&&!selectedBountyId);
 const [index,setIndex]=useState(0);
 const [readyIndex,setReadyIndex]=useState(-1);
 const actions=useRef({navigate,closeNavigation});actions.current={navigate,closeNavigation};
 const steps=useMemo(()=>dashboardTourSteps.map(step=>({
  target:`[data-tour="${step.target}"]`,title:step.title,content:step.content,
  before:()=>{actions.current.closeNavigation();actions.current.navigate(step.route);return Promise.resolve();},
 })),[]);
 useEffect(()=>{
  // Browser history navigation dismisses the tour. Its own router transitions
  // must not race a parent effect observing the previous route.
  if(!run)return;
  window.addEventListener('popstate',stop);
  return ()=>{window.removeEventListener('popstate',stop);};
 },[run,stop]);
 const onEvent=(event:EventData)=>{
  if(event.type==='step:before_hook'||event.type==='step:after')setReadyIndex(-1);
  if(event.type==='tooltip')setReadyIndex(event.index);
  if(event.type==='tour:end'||event.action==='close'||event.action==='skip'||event.type==='error'||event.type==='error:target_not_found'){stop();return;}
  if(event.type==='step:after'){
   const next=event.index+(event.action==='prev'?-1:1);
   if(next<0||next>=steps.length){stop();return;}
   setIndex(next);
  }
 };
 if(!run)return null;
 return <TourReadyContext.Provider value={readyIndex}><Joyride tooltipComponent={TourTooltip} continuous run stepIndex={index} steps={steps} onEvent={onEvent}
  locale={{back:'Back',next:'Next',nextWithProgress:'Next ({current} of {total})',last:'Done',skip:'Skip tour',close:'Close tour'}}
  options={{skipBeacon:true,showProgress:true,buttons:['back','skip','close','primary'],closeButtonAction:'skip',overlayClickAction:false,blockTargetInteraction:true,targetWaitTimeout:3000,scrollDuration:0,scrollOffset:80,width:'min(360px, calc(100vw - 32px))',primaryColor:'var(--c2-ink)',textColor:'var(--c2-ink)',backgroundColor:'var(--c2-surface)',spotlightRadius:12,zIndex:10000}}
  styles={{tooltip:{borderRadius:'var(--c2-radius-card)',fontFamily:'var(--c2-font-sans)',fontSize:14}}}
 /></TourReadyContext.Provider>;
}
