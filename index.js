require("./tracing.js")
const opentelemetry = require("@opentelemetry/api")
const http = require("http")
const { fork } = require("child_process")

const tracer = opentelemetry.trace.getTracer("worker.keepalive")

const DEBUG = true

const jobs = [
  {
    path: "./worker1.js",
    lock: new Int32Array(new SharedArrayBuffer(4)),
    count: new Int32Array(new SharedArrayBuffer(4)),
    process: null
  }
]

function spawnWorker(job){
  console.log("Spawning worker...")
  const worker = fork(job.path)
  job.process = worker
  worker.on("exit", code => {
    console.log(`Worker process exited with code ${code}`)
  })
  worker.on("disconnect", () => {
    console.log(`Worker process with pid ${worker.pid} has disconnected from the parent process.`)
    tracer.startActiveSpan(
      "worker.disconnect",
      disconnectSpan => {
        var attempts = 0
        do {
          console.log("trying to acquire lock to decrement process counter...")
          const acquired = !Atomics.compareExchange(job.lock, 0, 0, 1)
          attempts++
          console.log("lock acquired: " + acquired)
          if(acquired){
            Atomics.exchange(job.count, 0, 0)
            Atomics.exchange(job.lock, 0, 0)
            break
          }
        } while(true)
        disconnectSpan.setAttribute("lockAcquisitionAttempts", attempts)
        disconnectSpan.setAttribute("function", "spawnWorker->worker.onDisconnect")
        disconnectSpan.end()
      }
    )
  })
  console.log("done spawning worker")
}

http.createServer((req, res) => {
  tracer.startActiveSpan("worker.keepalive.http", span => {
    // set span attributes
    span.setAttribute("sourceFile", "index.js")
    span.setAttribute("function", "http.createServer")
    span.setAttribute("requestUrl", req.url)
    span.setAttribute("requestMethod", req.method)
    span.setAttribute("requestHeaders", JSON.stringify(req.headers))
    // try catch finally 
    try {
      if(req.url === "/ab8bbab8bb136136-8afc-4831-806e-4e5d23d9f04b" && (req.method === "GET" || req.method === "HEAD")){
        span.setAttribute("jobDefinitionsCount", jobs.length)
        span.setAttribute("matchedUrl", req.url)
        span.setAttribute("matchedMethod", req.method)
        jobs.forEach(job => {
          tracer.startActiveSpan(
            "worker.keepalive.http.job.check",
            innerSpan => {
              console.log("trying to instantiate worker")
              const { path, lock, count } = job
              innerSpan.setAttribute("workerPath", path)
              const acquired = !Atomics.compareExchange(lock, 0, 0, 1)
              if(acquired){
                if(!Atomics.compareExchange(count, 0, 0, 1)){
                  // worker not running, so spawn it
                  innerSpan.setAttribute("workerAlreadyRunning", false)
                  spawnWorker(job)
                } else {
                  // worker already running, so let it be
                  innerSpan.setAttribute("workerAlreadyRunning", true)
                }
                console.log(`lock before release: ${Atomics.load(lock, 0)}`)
                Atomics.exchange(lock, 0, 0)
                console.log(`lock after release: ${Atomics.load(lock, 0)}`)
              }
              innerSpan.end()
            }
          )
        })
        const r = [
          200,
          "Hello World"
        ]
        span.setAttribute("responseCode", r[0])
        span.setAttribute("responseMessage", r[1])
        res.writeHead(404)
        res.end()
      } else {
        console.log("Got unknown request.")
        span.setAttribute("responseCode", 404)
        res.writeHead(404)
        res.end()
      }
    } catch(e) {
      console.log("Server error:")
      console.log(e)
      span.recordException(e)
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR
      })
      span.setAttribute("responseCode", 500)
      res.writeHead(500)
      res.end()
    } finally {
      span.end()
    }
  })
}).listen(443, "0.0.0.0")

process.on("SIGTERM", () => {
  jobs.forEach(job => {
    job.process && job.process.disconnect()
  })
})