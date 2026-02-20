const Rcon = require("simple-rcon")

async function readRequestBody(req) {
  return await new Promise((resolve, reject) => {
    let data = ""
    req.on("data", chunk => {
      data += chunk
    })
    req.on("end", () => {
      resolve(data)
    })
    req.on("error", err => {
      reject(err)
    })
  })
}

async function handleRequest(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  let bodyText = ""
  try {
    bodyText = await readRequestBody(req)
  } catch (error) {
    res.statusCode = 400
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Failed to read request body" }))
    return
  }

  let payload
  try {
    payload = bodyText ? JSON.parse(bodyText) : {}
  } catch (error) {
    res.statusCode = 400
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Invalid JSON body" }))
    return
  }

  const command = payload && typeof payload.command === "string" ? payload.command.trim() : ""
  if (!command) {
    res.statusCode = 400
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "Missing command" }))
    return
  }

  const host = process.env.RCON_HOST
  const port = parseInt(process.env.RCON_PORT || "27015", 10)
  const password = process.env.RCON_PASSWORD

  if (!host || !password || Number.isNaN(port)) {
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ error: "RCON backend is not configured" }))
    return
  }

  let responseText = ""
  try {
    responseText = await new Promise((resolve, reject) => {
      const client = new Rcon({
        host,
        port: String(port),
        password
      })

      client.on("error", err => {
        client.close()
        reject(err)
      })

      client
        .exec(command, packet => {
          const body = packet && typeof packet.body === "string" ? packet.body : ""
          client.close()
          resolve(body)
        })
        .connect()
    })
  } catch (error) {
    res.statusCode = 500
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }))
    return
  }

  res.statusCode = 200
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify({ ok: true, response: responseText }))
}

module.exports = handleRequest

