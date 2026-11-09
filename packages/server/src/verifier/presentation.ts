import type { VerifyInput } from './collect.js';
import { contributionCommands } from '../github/comments.js';

function md(value:string):string{return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('`','\\`').replaceAll('[','\\[').replaceAll(']','\\]');}
export function checkSummary(input:{advisory:string;ci:string;reasoning?:string;unmet?:string[];headSha:string;baseSha:string;issueNumber:number}) {
 return `**${input.advisory}**\n\nCI for this exact revision: **${md(input.ci)}**. This check is advisory; it does not select an award or authorize payment. Contributors should address unmet requirements before merge. Maintainers can comment, request changes or close the PR on GitHub regardless of this assessment.\n\n${input.reasoning?md(input.reasoning):'No verifier verdict is available.'}${input.unmet?.length?`\n\nUnmet requirements:\n${input.unmet.map(value=>`- ${md(value)}`).join('\n')}`:''}\n\nA maintainer can request a fresh review in this PR with \`/bounty retry #${String(input.issueNumber)} ${input.headSha} ${input.baseSha}\`. Use \`/bounty status #${String(input.issueNumber)}\` for progress. Review attempt limits apply.\n\n${contributionCommands(input.issueNumber,input.headSha,input.baseSha)}`;
}
// Name why evidence is insufficient instead of a generic "ambiguous" message.
export function insufficientReasons(evidence:VerifyInput,prAuthorGhId:string,creatorGhId:string,ciRequired:boolean):string[] {
 const reasons:string[]=[];
 if(!evidence.eligibleAuthors.length)reasons.push(prAuthorGhId===creatorGhId?'The pull request author created this bounty, and bounty creators cannot earn their own bounty. A submission from another contributor is needed.':'The pull request author is not an eligible GitHub user account.');
 if(prAuthorGhId!==creatorGhId&&evidence.unverifiedAuthors.includes(creatorGhId))reasons.push('The bounty creator also authored commits in this pull request; a maintainer must review authorship.');
 const others=evidence.unverifiedAuthors.filter(id=>id!==creatorGhId).length;
 if(others)reasons.push(`${String(others)} additional commit author${others===1?'':'s'} could not be verified as payees; a maintainer must review authorship.`);
 if(evidence.truncated)reasons.push('Some of the pull request description or diff could not be collected in full.');
 if(!evidence.diff.trim())reasons.push('No reviewable code changes were found.');
 if(ciRequired&&evidence.ci.status!=='pass')reasons.push(`Required CI has not passed for this revision (${evidence.ci.status}).`);
 return reasons.length?reasons:['The collected evidence is incomplete.'];
}
