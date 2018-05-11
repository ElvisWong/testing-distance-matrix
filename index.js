const config = require('./config')
const express = require('express')
const googleMapsClient = require('@google/maps').createClient({
	key: config.apiKey
})
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const Route = require('./models/route')
const Token = require('./models/token')
const UIDGenerator = require('uid-generator')
const uidgen = new UIDGenerator() // Default is a 128-bit UID encoded in base58
const ortools = require('node_or_tools')

// express
const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

const options = {
    autoIndex: false, // Don't build indexes
    reconnectTries: 30, // Retry up to 30 times
    reconnectInterval: 500, // Reconnect every 500ms
    poolSize: 10, // Maintain up to 10 socket connections
    // If not connected, return errors immediately rather than waiting for reconnect
    bufferMaxEntries: 0
  }

let database = config.database
if (process.env.NODE_ENV === 'production') {
	database = config.database.replace('localhost', 'mongo')
}

const connectWithRetry = () => {
  console.log('MongoDB connection with retry')
  mongoose.connect(database, options).then(()=>{
    console.log('MongoDB is connected')
  }).catch(err=>{
    console.log('MongoDB connection unsuccessful, retry after 5 seconds.')
    setTimeout(connectWithRetry, 5000)
  })
}

connectWithRetry()

app.route('/')
	.get(async (req, res) => {
		res.send('<p>now running on port ' + config.port + '</p>')
	})

app.route('/route')
	.post(async (req, res) => {
		let points = req.body
		let routes = []
		let uid = await uidgen.generate()
		let token = new Token({_id: uid})
		let error = ''
		let stops = []
		token.routes = []
		for (let i = 0; i < points.length; i++) {
			let obj = { 'lat': points[i][0], 'lng': points[i][1] }
			stops.push(obj)
		}
		await new Promise((resolve) => {
			googleMapsClient.distanceMatrix({
				origins: stops, 
				destinations: stops
			}, async (err, res) => {
				if (err) {
					return res.status(200).send({error: err})
				} else {
					let results = res.json.rows
					for (let j = 0; j < results.length; j++) {
						let item = results[j]
						for (let k = 0; k < item.elements.length; k++) {
							let elm = item.elements[k]
							if (elm.status === "OK" && elm.distance.value !== 0) {
								let route = new Route({
										origin: points[j],
										destination: points[k],
										distance: elm.distance.value,
										duration: elm.duration.value
									})
								routes.push(await new Promise((resolve) => {
									route.save((err, result) => {
										if (err) {
											return res.status(200).send({error: err})
										} else {
											token.routes.push(result._id)
											resolve()
										}
									})
								}))
							}
						}
					}
				}
				await Promise.all(routes)
				await token.save()
				resolve()
			})
		})
		res.status(200).send({token: token._id})
	})

app.param('token', async (req, res, next, id) => {
	const token = await Token.findById(id)
	await token.populate({path: 'routes'}).execPopulate()
	if (!token) {
		res.status(200).json({status: 'failure', error: 'Token not found'})
	}
	req.data = token
	next()
})

app.route('/route/:token')
	.get(async (req, res) => {
		const routes = req.data.routes
		let result = {status: 'in progress'}
		let distanceMatrix = [], durationMatrix = []
		let origins = routes.map((n) => n.origin.join(',')).filter((elem, idx, arr) => {
			return arr.indexOf(elem) == idx
		})
		for (let i=0; i < origins.length; i++) {
			let distance = [], duration = []
			for (let j=0; j < origins.length; j++) {
				if (i==j) {
					distance.push(0)
					duration.push(0)
				} else {
					let x = routes.filter(n=>{
						return n.origin.join(',') === origins[i]
					})
					for (let k=0; k < x.length; k++) {
						if (origins[j] === x[k].destination.join(',') && origins[i] === x[k].origin.join(',')) {
							distance.push(x[k].distance)
							duration.push(x[k].duration)
						}
					}
				}
			}
			distanceMatrix[i] = distance
			durationMatrix[i] = duration
		}
		let tspSolverOpts = {
			numNodes: origins.length,
			costs: distanceMatrix
		}
		let TSP = new ortools.TSP(tspSolverOpts)
		let tspSearchOpts = {
			computeTimeLimit: 1000,
			depotNode: 0
		}
		await new Promise((resolve) => {
			TSP.Solve(tspSearchOpts, (err, res) => {
				if (err) {
					Object.assign(result, {status: "failure", error: err})
					resolve()
				} else {
					res.unshift(0)
					let path = res.map((n) => origins[n].split(','))
					let distance = 0, duration = 0
					for (let i=0; i < res.length-1; i++) {
						distance += distanceMatrix[i][i+1]
						duration += durationMatrix[i][i+1]
					}
					Object.assign(result, {path: path, total_distance: distance, total_time: duration, status: "success"})
					resolve()
				}
			})
		})
		res.status(200).json(result)
	})

app.listen(config.port, () => console.log('Example app listening on port %d!', config.port))
