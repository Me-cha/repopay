import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ClientSideRowModelModule,QuickFilterModule,themeQuartz,type ColDef,type ICellRendererParams } from 'ag-grid-community';
import { label,money,type BountyDto } from '../api.js';
const modules=[ClientSideRowModelModule,QuickFilterModule];
const theme=themeQuartz.withParams({fontFamily:'system-ui, sans-serif',fontSize:14,headerFontWeight:600,accentColor:'#174ea6',backgroundColor:'#ffffff',foregroundColor:'#18202b',headerBackgroundColor:'#f4f6fa',borderColor:'#d9dee5',rowHoverColor:'#eef4ff',spacing:8});
export function Bounties({rows,onSelect,filter}:{rows:BountyDto[];onSelect:(id:string)=>void;filter:string}){
 const columns=useMemo<ColDef<BountyDto>[]>(()=>[
  {headerName:'Issue',field:'title',flex:2,minWidth:260,cellRenderer:({data}:ICellRendererParams<BountyDto>)=>data?<button className="row-link" onClick={()=> { onSelect(data.id); }}>{data.repoFullName} #{data.issueNumber}<span className="row-title">{data.title}</span></button>:null},
  {headerName:'Bounty',field:'amountCents',width:130,valueFormatter:p=>money(Number(p.value))},
  {headerName:'Status',field:'status',width:170,valueFormatter:p=>label(String(p.value))},
  {headerName:'Review',valueGetter:p=>p.data?.latestReview?.verdict??'Not reviewed',width:150},
  {headerName:'Delivered',valueGetter:p=>p.data?.award?.paidCents??0,valueFormatter:p=>money(Number(p.value)),width:130},
  {headerName:'Next actor',valueGetter:p=>p.data?.nextAction.actor,minWidth:180,flex:1},
 ],[onSelect]);
 return <><div className="mobile-list" role="region" aria-label="Bounty list">{rows.filter(b=>(b.repoFullName+' '+b.title+' '+b.status).toLowerCase().includes(filter.toLowerCase())).map(b=><article key={b.id}><button className="row-link" onClick={()=>{onSelect(b.id);}}>{b.repoFullName} #{b.issueNumber}<span className="row-title">{b.title}</span></button><p><strong>{money(b.amountCents)}</strong> · {label(b.status)}</p><p>Delivered: {money(b.award?.paidCents??0)}</p><a href={b.nextAction.href}>{b.nextAction.label}</a></article>)}</div><div className="grid" aria-label="Bounties table"><AgGridReact<BountyDto> modules={modules} theme={theme} rowData={rows} columnDefs={columns} defaultColDef={{sortable:true,resizable:true}} quickFilterText={filter} getRowId={p=>p.data.id} rowHeight={72} headerHeight={48} animateRows={false} ensureDomOrder={true} suppressColumnVirtualisation={true} suppressRowVirtualisation={true} domLayout="autoHeight" onCellKeyDown={e=>{if(e.event instanceof KeyboardEvent&&e.event.key==='Enter'&&e.data)onSelect(e.data.id);}} overlayNoRowsTemplate="No bounties on this page."/></div></>;
}
