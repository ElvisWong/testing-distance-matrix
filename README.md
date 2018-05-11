# Testing Distance Matrix API

A small project for testing the usage of distance matrix in Google Map API with nodeJS

## Getting Started

Simply clone this project and run docker-compose to setup all the stuffs in docker

```
docker-compose up --build
```

### Prerequisites

Docker need to be installed before you can run. 

Here is the link you can setup the docker on your computer: (https://docs.docker.com/compose/install/ "Docker Installation")

Also, you have to setup the google API key in config.js for using the distance matrix API, just simply put your API key from the Google API console before you can run it

Here is the link you can get the references on how to get the API key: (https://developers.google.com/maps/documentation/embed/get-api-key "Google API Console - API Key")

### How to Run it

After installed docker you can run docker-compose to run
```
docker-compose up --build
```

After complete the build up on docker, you can try to access the localhost:8080 and check whether it is running on (http://localhost:8080/)

### How to test it

There are two HTTP endpoints that you can play around with it. 

* `POST /route`: which will return the a token

* `GET /route/<token`: which will return the results

Start your `mongod` in terminal and just run `npm test`