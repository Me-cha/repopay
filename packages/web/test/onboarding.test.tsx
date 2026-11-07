import { StrictMode } from 'react';
import { renderHook,waitFor,act } from '@testing-library/react';
import { expect,it,vi } from 'vitest';
import { api } from '../src/api.js';
import { useDashboardTour } from '../src/hooks/useDashboardTour.js';
it('claims once in StrictMode and closes permanently for this mount',async()=>{
 const claim=vi.spyOn(api,'claimDashboardTour').mockResolvedValue({show:true});
 vi.spyOn(api,'dashboardTour').mockResolvedValue({seen:false,csrf:'token'});
 const {result,rerender}=renderHook(()=>useDashboardTour('4',true),{wrapper:StrictMode});
 await waitFor(()=>{expect(result.current.run).toBe(true);});expect(claim).toHaveBeenCalledTimes(1);
 act(()=>{result.current.stop();});rerender();expect(result.current.run).toBe(false);expect(claim).toHaveBeenCalledTimes(1);
});
it('does not claim for seen accounts or while the page is loading',async()=>{
 const read=vi.spyOn(api,'dashboardTour').mockResolvedValue({seen:true,csrf:'token'});
 const claim=vi.spyOn(api,'claimDashboardTour');
 const {result,rerender}=renderHook(({ready})=>useDashboardTour('4',ready),{initialProps:{ready:false}});
 expect(read).not.toHaveBeenCalled();rerender({ready:true});await waitFor(()=>{expect(read).toHaveBeenCalled();});
 expect(result.current.run).toBe(false);expect(claim).not.toHaveBeenCalled();
});
it('fails quietly on unavailable persistence',async()=>{
 vi.spyOn(api,'dashboardTour').mockRejectedValue(new Error('offline'));
 const {result}=renderHook(()=>useDashboardTour('4',true));await act(async()=>{await Promise.resolve();});
 expect(result.current.run).toBe(false);
});

it('does not restart a dismissed tour when readiness recovers',async()=>{
 vi.spyOn(api,'dashboardTour').mockResolvedValue({seen:false,csrf:'token'});
 vi.spyOn(api,'claimDashboardTour').mockResolvedValue({show:true});
 const {result,rerender}=renderHook(({ready})=>useDashboardTour('4',ready),{initialProps:{ready:true}});
 await waitFor(()=>{expect(result.current.run).toBe(true);});
 act(()=>{result.current.stop();});rerender({ready:false});rerender({ready:true});
 await act(async()=>{await Promise.resolve();});expect(result.current.run).toBe(false);
});
