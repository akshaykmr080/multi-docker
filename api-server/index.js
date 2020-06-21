const keys  = require('./keys');

// Express app setup
const express = require('express');
const bodyparser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyparser.json());

// Postgres Client setup
const { Pool } = require('pg');
console.log(keys.pgUser);
console.log(keys.pgUser);
console.log(keys.pgPassword);
console.log(keys.pgHost);
console.log(keys.pgPort);
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});

pgClient.on('connect', () => {
    pgClient
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch(err => console.log(err));
})

// Redis setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
})

const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
    res.send('hi');
});

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * from values');

    res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    })
});

app.post('/values', async (req, res) => {
    const index = req.body.index;

    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }

    // store a dummy value in redis
    redisClient.hset('values', index, 'Nothing yet!');

    // publish an event so that the worker can calculate the fibonacci number
    // & store it in redis
    redisPublisher.publish('insert', index);

    // store the submitted index in postgres
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({ working: true });
});

app.listen(5000, err => {
    console.log('Listening');
})