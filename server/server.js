import express from 'express'
import fs from 'fs'
import path from 'path'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

// Path to /public/created-maps
const mapsDir = path.join(process.cwd(), 'public', 'created-maps')

// Ensure folder exists
if (!fs.existsSync(mapsDir)) {
  fs.mkdirSync(mapsDir, { recursive: true })
}

// Save map endpoint
app.post('/save-map', (req, res) => {
  const { name, data } = req.body

  if (!name || !data) {
    return res.status(400).json({ error: 'Missing name or data' })
  }

  const filePath = path.join(mapsDir, `${name}.json`)

  fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
    if (err) {
      console.error('Error saving map:', err)
      return res.status(500).json({ error: 'Failed to save map' })
    }

    res.json({ success: true, path: `/created-maps/${name}.json` })
  })
})

const PORT = 5000
app.listen(PORT, () => {
  console.log(`Map save server running on port ${PORT}`)
})
