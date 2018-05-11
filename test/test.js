const mongoose = require('mongoose')
const Route = require('../models/route')
const Token = require('../models/token')

const chai = require('chai')
let chaiHttp = require('chai-http')
let server = require('../index')
let should = chai.should()

chai.use(chaiHttp)

describe('Route', () => {
  before((done) => {
    Route.remove({}, (err) => { 
     done()         
    })     
  })
  before((done) => {
    Token.remove({}, (err) => { 
     done()         
    })     
  })  

  let token = ''

	describe('/POST /Route', () => {
			it('it should POST the drop-off point and create routes', (done) => {
				let route = [
					["22.372081", "114.107877"],
					["22.284419", "114.159510"],
					["22.326442", "114.167811"]
				]

				chai.request('http://localhost:8080')
					.post('/route')
					.send(route)
					.end((err, res) => {
						res.should.have.status(200)
	          res.should.be.json
	          res.body.should.be.a('object')
	          res.body.should.have.property('token')
	          token = res.body.token
	          done()
					})
			})
		})

	describe('/GET /Route/<Token>', () => {
	    it('it should GET the path of a token', (done) => {
	          chai.request('http://localhost:8080')
	          .get('/route/' + token) 
	          .end((err, res) => {
	              res.should.have.status(200)
	              res.body.should.be.a('object')
	              res.body.should.have.property('status')
	              res.body.should.have.property('path')
	              res.body.should.have.property('total_distance')
	              res.body.should.have.property('total_time')
	            done()
	          })
	    })
		})

})
