const https = require('https');
require('dotenv').config();

const API_KEY = process.env.RAPIDAPI_KEY;
const API_HOST = process.env.RAPIDAPI_HOST || 'sofascore.p.rapidapi.com';

const options = {
    method: 'GET',
    hostname: API_HOST,
    port: null,
    path: '/tournaments/get-standings?seasonId=77805&tournamentId=52',
    headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': API_HOST
    }
};

const req = https.request(options, function (res) {
    const chunks = [];

    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', JSON.stringify(res.headers, null, 2));

    res.on('data', function (chunk) {
        chunks.push(chunk);
    });

    res.on('end', function () {
        const body = Buffer.concat(chunks);
        // console.log(body.toString());
    });
});

req.end();
