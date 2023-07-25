require("./tracing.js")
const opentelemetry = require("@opentelemetry/api")
const { createMachine, interpret, actions } = require("xstate")
const crypto = require("crypto")
var execSync = require("child_process").execSync
const fs = require("fs")

const { assign, log } = actions
const tracer = opentelemetry.trace.getTracer("worker.worker1")

function avg(array) {
  return array.reduce((total, number, index, array) => {
    total += number
    if (index === array.length - 1) {
      return total / array.length
    } else {
      return total
    }
  })
}

function stdev(array) {
  const mean = avg(array)
  const differences = array.map(number => number - mean)
  const squaredDifferences = differences.map(difference => difference ** 2)
  const sumofSquaredDifferences = squaredDifferences.reduce((acc, curr) => acc + curr)
  return Math.sqrt(sumofSquaredDifferences / (array.length - 1 || 1))
}

const job = createMachine({
  predictableActionArguments: true,
  initial: "init",
  context: {},
  states: {
    init: {
      always: [
        {
          target: "running",
          actions: [
            assign(ctx => ({
              ...ctx,
              fileId: "7afad069-6807-47cd-be00-0ce06f32b801",
              workerId: crypto.randomUUID(),
              cpuUsages: [],
              metricAccumulationCounter: 0
            })),
          ]
        }
      ]
    },
    running: {
      initial: "idle",
      states: {
        idle: {
          invoke: {
            src: () => new Promise(res => setTimeout(res, 5000)),
            onDone: {
              target: "busy",
              actions: [
                log("running->idle->onDone")
              ]
            }
          }
        },
        busy: {
          invoke: {
            src: () => new Promise(res => setTimeout(res, 5000)),
            onDone: {
              target: "idle",
              actions: [
                log("running->busy->onDone"),
                assign(ctx => {
                  // https://unix.stackexchange.com/questions/450748/calculating-cpu-usage-of-a-cgroup-over-a-period-of-time#451005
                  var cpu, time
                  time = parseInt(execSync(
                    "echo $(date +%s%N)"
                  ).toString().trim())
                  cpu = parseInt(execSync(
                    "cat /sys/fs/cgroup/cpu/cpuacct.usage"
                  ).toString().trim())
                  var lastTime = ctx.time
                  var lastCpu = ctx.cpu
                  var cpuUsage = ((cpu - lastCpu) / (time - lastTime)) * 100
                  if (ctx.cpuUsages.length > 12) {
                    ctx.cpuUsages.shift()
                  }
                  return {
                    ...ctx,
                    time: time,
                    cpu: cpu,
                    cpuUsages: [
                      ...ctx.cpuUsages,
                      cpuUsage
                    ]
                  }
                }),
                assign(ctx => {
                  ctx.metricAccumulationCounter++
                  console.log(ctx.metricAccumulationCounter)
                  if (ctx.metricAccumulationCounter >= 12) {
                    ctx.metricAccumulationCounter = 0
                    tracer.startActiveSpan(
                      "worker.worker1.metricsAggregation",
                      a => {
                        a.setAttribute("workerId", ctx.workerId)
                        a.setAttribute("fileId", ctx.fileId)
                        a.setAttribute("sourceFile", "worker1.js")
                        a.setAttribute("avgCpuUsage", avg(ctx.cpuUsages))
                        a.setAttribute("maxCpuUsage", Math.max(...ctx.cpuUsages))
                        a.setAttribute("minCpuUsage", Math.min(...ctx.cpuUsages))
                        a.setAttribute("numCpuUsages", ctx.cpuUsages.length)
                        a.setAttribute("stdevCpuUsage", stdev(ctx.cpuUsages))
                        a.end()
                      }
                    )
                  }
                  return ctx
                })
              ]
            }
          }
        }
      }
    },
    fin: {
      type: "final",
      entry: [
        () => {
          process.exit(0)
        }
      ]
    }
  },
  onError: {
    actions: [
      () => {
        process.exit(1)
      }
    ]
  }
})

const jobSvc = interpret(job)

jobSvc.start()