/*jshint esnext: true */
/* jshint node: true */

'use strict';

var tado = require('./client.js').Client;

// Authentication via .netrc
var netrc = require('node-netrc');
const auth = netrc('my.tado.com');

// InfluxDB
//const DB_HOST = 'elcap.ddns.net';
const DB_HOST = 'localhost';
const DB_NAME = 'tadodb';

var Influx = require('influx');
const influx = new Influx.InfluxDB({
    host: DB_HOST,
});

const logInterval = 10*60*1000; /* logging interval in ms */
var homeId;
var home;
var zones;

/* Misc functions */

function authorize(login, pass) {
    return new Promise((resolve, reject) => {
        tado.login(login, pass)
            .then((result) => {
                if (result) {
                    resolve(true);
                } else {
                    reject(false);
                }
            });
    });
}

function dbCreatePolicy() {
    return new Promise((resolve,reject) => {

        influx.createRetentionPolicy('52w',
            {
                database: DB_NAME,
                duration: '52w',
                isDefault: true,
                replication: 1
            })
            .then(resolve(true))
            .catch(reject(false));
    });
};

function initDB() {
    return new Promise((resolve, reject) => {
        influx.createDatabase(DB_NAME)
            .then(result => {
                dbCreatePolicy();
                console.log('Connected to database:', 'http://' + DB_HOST + '/' + DB_NAME);
                resolve(true);
            }, result => {
                reject(result);
            })
    });
}


function tadoSetup() {
    return new Promise((resolve, reject) => {

        authorize(auth.login, auth.password)
            .then(result => {
                tado.me()
                    .then(result => { 
                        homeId = result.homes[0].id;
                        
                        Promise.all([tado.home(homeId), tado.zones(homeId)])
                            .then(results => {
                                home = results[0];
                                zones = results[1];
                                resolve(true);
                            });
                    })
                    .catch(err => {console.log(err)})
            })
            .catch(reject => {
                console.log('TADO authorization failed! ', reject);
                reject(false);
            });
    });
}

function tadoLogger() {

    for (var zone of zones) {
        tado.state(homeId, zone.id)
            .then((result) => {
                influx.writeMeasurement('thermostat', [
                    {
                        tags: {zone: zone.name},
                        fields: {
                            temperature: result.sensorDataPoints.insideTemperature.celsius,
                            humidity: result.sensorDataPoints.humidity.percentage,
                        },
                    }
                ],
                    {
                        database: DB_NAME,
                        retentionPolicy: '52w',
                        precision: 's'
                    }
                ).then(result => {
//                    console.log('Data written to db');    
                })
                .catch(err => {
                        console.log('Error writing to db', err);
                });
            })
            .catch(err => {
               console.error(`Error reading from the thermostat! - `, err);
            });
            
        setTimeout(tadoLogger, logInterval);
    }
}

Promise.all([initDB(), tadoSetup()])
    .then(results => {
        console.log('Logging started...');
        tadoLogger();
    }, results => {
        console.log('Initialization failed with error: ', results.code);
    });
