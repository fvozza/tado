/*

The MIT License (MIT)

Copyright (c) 2016 Daniel Holzmann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

/*jshint esnext: true */
/* jshint node: true */

'use strict';

var request = require('request');
var moment = require('moment');

const BASE_URL = 'https://my.tado.com';
const CLIENT_ID = 'tado-webapp';
const REFERER = 'https://my.tado.com/';

module.exports.Client = new class Client {
    login(username, password) {
        return new Promise((resolve, reject) => {
            request.post({
                url: BASE_URL + '/oauth/token',
                qs: {
                    client_id: CLIENT_ID,
                    grant_type: 'password',
                    password: password,
                    username: username,
                    scope: 'home.user'
                },
                json: true
            }, (err, response, result) => {
                if (err || response.statusCode !== 200) {
                    reject(err || result);
                } else {
                    this.saveToken(result);
                    resolve(true);
                }
            });
        });
    }

    saveToken(token) {
        this.token = token;
        this.token.expires_in = moment().add(token.expires_in, 'seconds').toDate();
//        console.log(this.token, this.token.expires_in);
    }

    refreshToken() {
        return new Promise((resolve, reject) => {
            if (!this.token) {
                return reject(new Error('not logged in'));
            }

            if (moment().subtract(5, 'seconds').isBefore(this.token.expires_in)) {
                return resolve();
            }

            request.get({
                url: BASE_URL + '/oauth/token',
                qs: {
                    client_id: CLIENT_ID,
                    grant_type: 'refresh_token',
                    refresh_token: this.token.refresh_token
                },
                json: true
            }, (err, response, result) => {
                if (err || response.statusCode !== 200) {
                    reject(err || result);
                } else {
                    this.saveToken(result);
                    resolve(true);
                }
            });
        });
    }

    api(path) {
        return this.refreshToken()
            .then(() => {
                return new Promise((resolve, reject) => {
                    request.get({
                        url: BASE_URL + '/api/v2' + path,
                        json: true,
                        headers: {
                            referer: REFERER
                        },
                        auth: {
                            bearer: this.token.access_token
                        }
                    }, (err, response, result) => {
                        if (err || response.statusCode !== 200) {
                            reject(err || result);
                        } else {
                            resolve(result);
                        }
                    });
                });
            });
    }

    me() {
        return this.api('/me');
    }

    home(homeId) {
        return this.api(`/homes/${homeId}`);
    }

    zones(homeId) {
        return this.api(`/homes/${homeId}/zones`);
    }

    weather(homeId) {
        return this.api(`/homes/${homeId}/weather`);
    }

    state(homeId, zoneId) {
        return this.api(`/homes/${homeId}/zones/${zoneId}/state`);
    }
}
