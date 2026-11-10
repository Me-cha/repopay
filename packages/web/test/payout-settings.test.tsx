import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PayoutsPage } from '../src/pages/PayoutsPage.js';
const state=vi.hoisted((): {connected:boolean|null;refreshAll:ReturnType<typeof vi.fn>}=>({
 connected: true,
 refreshAll: vi.fn(),
}));
vi.mock('../src/context/AuthContext.js',()=>({useAuth:()=>({user:{id:'8',login:'contributor'}})}));
vi.mock('../src/router/Router.js',()=>({useRouter:()=>({path:'/dashboard/payouts/settings',navigate:vi.fn()})}));
vi.mock('../src/context/WorkspaceDataContext.js',()=>({useWorkspaceData:()=>({
 payouts:[],connectStatus:state.connected===null?null:{connected:state.connected,maskedEmail:state.connected?'c•••@e•••.com':null,connectionVersion:1},
 stats:{awaitingClaimCount:0,awaitingClaimCents:0},initialLoading:false,refreshing:false,refreshAll:state.refreshAll,openBountyDetail:vi.fn(),savePayoutEmail:vi.fn(),
})}));
beforeEach(()=>{state.connected=true;state.refreshAll.mockClear();});
it('reuses the saved destination and shows an empty email form only after an explicit change request',()=>{
 render(<PayoutsPage/>);
 expect(screen.getByText(/do not need to enter it again/)).toBeTruthy();
 expect(screen.queryByLabelText('PayPal recipient email')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Change payout destination'}));
 const input=screen.getByLabelText('PayPal recipient email');
 fireEvent.change(input,{target:{value:'changed@example.com'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel change'}));
 expect(screen.queryByLabelText('PayPal recipient email')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Change payout destination'}));
 expect(screen.getByLabelText<HTMLInputElement>('PayPal recipient email').value).toBe('');
});
it('offers initial connection only when the server confirms no destination is saved',()=>{
 state.connected=false;render(<PayoutsPage/>);
 expect(screen.getByLabelText('PayPal recipient email')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Connect Destination'})).toBeTruthy();
});
it('failed status loading does not ask an already signed-in user to connect again',()=>{
 state.connected=null;render(<PayoutsPage/>);
 expect(screen.queryByLabelText('PayPal recipient email')).toBeNull();
 expect(screen.queryByText('Not Connected')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry payout status'}));
 expect(state.refreshAll).toHaveBeenCalledOnce();
});
