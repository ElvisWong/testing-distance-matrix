const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId

const schema = new mongoose.Schema({
	_id: { type: String },
	routes: [{ type: ObjectId, ref: 'route' }]
}, {timestamps: true})

module.exports = mongoose.model('token', schema)
