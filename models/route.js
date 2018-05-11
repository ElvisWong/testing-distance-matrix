const mongoose = require('mongoose')

const schema = new mongoose.Schema({
	origin: [{ type: Number }],
	destination: [{ type: Number }],
	distance: { type: Number },
	duration: { type: Number }
})

module.exports = mongoose.model('route', schema)
