const config = require('./config')
const express = require('express')
const googleMapsClient = require('@google/maps').createClient({
	key: config.apiKey
})
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const Route = require('./models/route')
const Token = require('./models/token')
const UIDGenerator = require('uid-generator');
const uidgen = new UIDGenerator(); // Default is a 128-bit UID encoded in base58
const solver = require('node-tspsolver')

// express
const app = express()

app.use(bodyParser.json())

mongoose.connect('mongodb://mongo:27017')
  .then(() =>  console.log('Database connection successful'))
  .catch((err) => console.error(err));

app.route('/')
	.get(async (req, res) => {
		res.send('<p>now running on port 8080</p>')
	})

app.route('/route')
	.post(async (req, res) => {
		let points = req.body.input
		let routes = []
		let uid = await uidgen.generate()
		let token = new Token({_id: uid})
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
									token.routes.push(result._id)
									resolve()
								})
							}))
						}
					}
				}
				await Promise.all(routes)
				await token.save()
				resolve()
			})
		})
		res.send({token: token._id})
	})

app.param('token', async (req, res, next, id) => {
	const token = await Token.findById(id)
	await token.populate({path: 'routes'}).execPopulate()
	if (!token) {
		console.log("err: token not found!")
	}
	req.data = token
	next()
})

app.route('/route/:token')
	.get(async (req, res) => {
		const routes = req.data.routes
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
		let result = {status: 'in progress'}
		await solver.solveTsp(distanceMatrix, false, {}).then((res) => {
			let path = res.map((n) => origins[n].split(','))
			let distance = 0, duration = 0
			for (let i=0; i < res.length-1; i++) {
				distance += distanceMatrix[i][i+1]
				duration += durationMatrix[i][i+1]
			}
			Object.assign(result, {path: path, total_distance: distance, total_time: duration, status: "success"})
		})
		res.json(result)
	})

app.listen(config.port, () => console.log('Example app listening on port %d!', config.port))
