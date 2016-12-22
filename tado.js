/*jshint esnext: true */
/* jshint node: true */

var tado = require('./client.js').Client;
var events = require('events');

// Authentication via .netrc
var netrc = require('node-netrc');
const auth = netrc('my.tado.com');

// InfluxDB
const DB_HOST = 'elcap.ddns.net';
const DB_NAME = 'tadodb';

var Influx = require('influx');
const influx = new Influx.InfluxDB({
    host: DB_HOST,
});

var homeId;
var home;
var zones;
var authenticated = false;

/* Events handlers */
var eventEmitter = new events.EventEmitter();
eventEmitter.on('authenticated', setup);
eventEmitter.on('ready', theLoop);

/* Misc functions */
function setup() {
    return new Promise((resolve, reject) => {

        tado.me()
            .then((result) => {
                homeId = result.homes[0].id;

                tado.home(homeId).then((result) => {
                    home = result;

                    tado.zones(homeId).then((result) => {
                        zones = result;

                        eventEmitter.emit('ready');
                        resolve(true);
                    });
                });
            })
            .catch(reject => {
                console.log(reject);
            });
    });
}

function initDB() {
    influx.getDatabaseNames()
        .then(names => {
            if (!names.includes(DB_NAME)) {
                console.log('Database %s created', DB_NAME);
                return influx.createDatabase(DB_NAME);
            } else {
                console.log('Connected to database:', DB_HOST+ '/' + DB_NAME);
            }
            eventEmitter.emit('dbok');
        })
        .catch(err => {
            console.error(`Error creating Influx database! - `, err);
        });
}

function authorize(login, pass) {
    tado.login(login, pass).then((success) => {
        if (success) {
            authenticated = true;
            eventEmitter.emit('authenticated');
        }
    });
}


function theLoop() {

    for (var zone of zones) {
        tado.state(homeId, zone.id).then((result) => {
            
            influx.writeMeasurement('thermostat', [
                {
                    tags: {zone: 'Living Room'},
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
            );
            
            setTimeout(theLoop, 5000);
        });
    }
}

initDB();
authorize(auth.login, auth.password);
