# GitPay local inspection collection

Import [gitpay.postman_collection.json](gitpay.postman_collection.json) into current Postman. It contains health and scoped read API requests, plus an inert synthetic GitHub `ping`. There are no checkout, payout, refund or merge requests. A collection is a debugging aid, not evidence that live provider workflows passed.

Use `baseUrl=http://127.0.0.1:3000`. Health requires no login; the read API requires a current GitPay session and repository access. Keep session cookies only in your local cookie jar. A 401 without a session is expected. Do not export cookies, tokens, recipient addresses or a populated environment.

The synthetic request is **skipped by default**. It requires a loopback HTTP base URL and environment variable `allowSyntheticWebhooks` set to the string `true`. It cannot run against the tunnel or a hosted server. It does not dispatch business work. A valid signature normally returns 202; a changed body/signature returns 401; recovery hold returns 503. The ping can leave a delivery receipt.

To sign the exact fixed body for your own local development receiver, run from the repository using pinned Node (reads the ignored `.env`; prints only the HMAC, not the secret):

```sh
node --env-file=.env --input-type=module -e 'import {createHmac} from "node:crypto"; const key=process.env.GH_WEBHOOK_SECRET; if(!key) throw new Error("Missing local webhook secret"); console.log("sha256="+createHmac("sha256",key).update(JSON.stringify({zen:"GitPay synthetic local ping"})).digest("hex"));'
```

Set the output as the **local** Postman environment variable `syntheticSignature`, then send the ping. Each send gets a fresh synthetic delivery ID. Remove the signature and disable `allowSyntheticWebhooks` after use. The secret itself never needs to enter Postman. Do not modify the body without regenerating the signature.

The skip guard follows the [official Postman execution API](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/). Use a client supporting `pm.execution.skipRequest`; do not remove the guard for older clients. GUI import/sending is a manual tooling check; local script tests alone do not establish a Postman GUI pass.
