import { createContext,useContext } from 'react';
import type { TooltipRenderProps } from 'react-joyride';
export const TourReadyContext=createContext(-1);
// Joyride can render a tooltip before its scroll/position lifecycle is ready.
// Disable navigation until that step is interactive, including during rapid clicks.
export function TourTooltip({backProps,closeProps,index,isLastStep,primaryProps,size,skipProps,step,tooltipProps}:TooltipRenderProps) {
 const ready=useContext(TourReadyContext)===index;
 return <div {...tooltipProps} className="c2-tour" style={step.styles.tooltip} aria-labelledby="dashboard-tour-title" aria-describedby="dashboard-tour-description">
  <button {...closeProps} type="button" className="c2-tour-close"><span aria-hidden="true">×</span></button>
  <p className="c2-tour-progress">Quick tour · {index+1} of {size}</p>
  <h2 id="dashboard-tour-title">{step.title}</h2>
  <p id="dashboard-tour-description">{step.content}</p>
  <div className="c2-tour-footer">
   <button {...skipProps} type="button" className="c2-tour-skip">Skip tour</button>
   {index>0&&<button {...backProps} type="button" className="c2-btn c2-btn-secondary" disabled={!ready}>Back</button>}
   <button {...primaryProps} type="button" className="c2-btn c2-btn-primary" disabled={!ready}>{isLastStep?'Done':'Next'}</button>
  </div>
 </div>;
}
