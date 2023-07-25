// tracing.js
"use strict"

const { HoneycombSDK } = require("@honeycombio/opentelemetry-node")

const sdk = new HoneycombSDK({
  instrumentations: []
})

sdk.start()
console.log("Honeycomb activated!")