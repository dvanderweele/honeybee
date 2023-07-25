# honeybee

This is a starter/template project which originated on Replit. It is for Node.js project with a few features:

🚀 built in http server with an endpoint for targeting with an uptime service such as uptime robot — *or another server like this of your own!*
🚀 job/process monitor built into uptime endpoint that will start any configured jobs or processes which quit running. It is as fault-tolerant as your uptime signal, and will keep the correct number of jobs running!
🚀 built in CPU usage monitoring job already configured
🚀 logging configured and built in via opentelemetry to log to honeycomb

## Files

**index.js**

the main http server file which is configured to run with Replit's run button. it supports one uptime endpoint which, when hit, will try to acquire a lock in order to spawn new job processes if required. references to the other jobs to be run are configured near the top of this file.

**tracing.js**

where honeycomb's opentelemetry is configured

**worker1.js**

example job. an xstate machine which does a primitive take on aggregation sampling of CPU usage metrics. you can have more than one job, and they will be their own process which can do anything you like, discord bot, web scraper, etc.