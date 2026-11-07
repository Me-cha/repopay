export const dashboardTourSteps=[
 {target:'overview',route:'/dashboard',title:'Welcome to Repopay',content:'Your dashboard tracks issue bounties from funding to payment. This quick tour appears only once; you can skip or close it at any time.'},
 {target:'contributions',route:'/dashboard/contributions',title:'Find your bounties',content:'Contributions brings together the issues you can access. Work stays on GitHub: create a bounty there, then follow its funding and review status here.'},
 {target:'bounty-records',route:'/dashboard/contributions',title:'Inspect the details',content:'When bounties are available, open a record to see its issue, linked pull requests, review reasoning and payment progress. An empty list simply means there is nothing to show yet.'},
 {target:'needs-review',route:'/dashboard/contributions?filter=NEEDS_REVIEW',title:'See what needs review',content:'This filter shows bounties awaiting a maintainer decision. Review the exact PR evidence and follow the authenticated action link; viewing this page never approves a payment.'},
 {target:'payouts',route:'/dashboard/payouts',title:'Track payment progress',content:'Check pending, successful and failed deliveries here. A merged pull request is not a payment receipt; look for confirmed delivery status.'},
 {target:'payout-settings',route:'/dashboard/payouts/settings',title:'Connect your payout destination',content:'Save your PayPal address here when you are ready to receive an award. This tour does not change it. You are ready to explore Repopay.'},
] as const;
