"use strict";
/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNoTelemetryFlag = exports.isCI = exports.hasUserOptedInOrOut = exports.isOptedIn = exports.clear = exports.turnOff = exports.turnOn = exports.track = exports.showPrompt = exports.timeoutInSecs = void 0;
// For further details on telemetry, see:
// https://github.com/cordova/cordova-discuss/pull/43
// Google Analytics tracking code
const GA_TRACKING_CODE = 'UA-64283057-7';
const os_1 = require("os");
const insight_1 = __importDefault(require("insight"));
const package_json_1 = __importDefault(require("../package.json"));
/**
 * By redefining `get optOut` we trick Insight into tracking
 * even though the user might have opted out.
 *
 * @todo The discussion on #43 specifically mentions that users should be able
 * to opt out - so why not allow them?
 */
class RelentlessInsight extends insight_1.default {
    constructor() {
        super(...arguments);
        this._permissionTimeout = 30;
        // This class is unexported and `getOpt` is never accessed, so I don't
        // think this actually did anything.
        // get optOut () { return false; }
        // set optOut (value) { super.optOut = value; }
        // get realOptOut () { return super.optOut; }
    }
}
const insight = new RelentlessInsight({
    trackingCode: GA_TRACKING_CODE,
    pkg: package_json_1.default
});
exports.timeoutInSecs = 30;
/**
 * Prompts the user to allow telemetry, and returns their response.
 *
 * @returns `true` if the user opted in, and `false` otherwise.
 */
function showPrompt() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => {
            const msg = 'May Cordova anonymously report usage statistics to improve the tool over time?';
            insight._permissionTimeout = exports.timeoutInSecs || 30;
            insight.askPermission(msg, (_, optIn) => {
                if (optIn) {
                    console.log(os_1.EOL + 'Thanks for opting into telemetry to help us improve cordova.');
                    track('telemetry', 'on', 'via-cli-prompt-choice', 'successful');
                }
                else {
                    console.log(os_1.EOL + 'You have been opted out of telemetry. To change this, run: cordova telemetry on.');
                    // Always track telemetry opt-outs! (whether opted-in or opted-out)
                    track('telemetry', 'off', 'via-cli-prompt-choice', 'successful');
                }
                resolve(optIn);
            });
        });
    });
}
exports.showPrompt = showPrompt;
function track(...args) {
    // Remove empty, null or undefined strings from arguments
    const filteredArgs = args.filter(val => val && val.length !== 0);
    insight.track(...filteredArgs);
}
exports.track = track;
/** Turns on telemetry. */
function turnOn() {
    insight.optOut = false;
}
exports.turnOn = turnOn;
/** Turns off telemetry. */
function turnOff() {
    insight.optOut = true;
}
exports.turnOff = turnOff;
/**
 * Clears telemetry setting
 * Has the same effect as if user never answered the telemetry prompt
 * Useful for testing purposes
 */
function clear() {
    // optOut is modeled as a boolean, but can apparently be undefined.
    insight.optOut = undefined;
}
exports.clear = clear;
/**
 * Returns whether or not the user has opted into telemetry.
 */
function isOptedIn() {
    return !insight.optOut;
}
exports.isOptedIn = isOptedIn;
/**
 * Has the user already answered the telemetry prompt? (thereby opting in or out?)
 */
function hasUserOptedInOrOut() {
    return insight.optOut !== undefined;
}
exports.hasUserOptedInOrOut = hasUserOptedInOrOut;
/**
 * Is the environment variable 'CI' specified ?
 */
function isCI(env) {
    return "CI" in env;
}
exports.isCI = isCI;
/**
 * Has the user ran a command of the form: `cordova run --no-telemetry` ?
 */
function isNoTelemetryFlag(args) {
    return args.indexOf('--no-telemetry') > -1;
}
exports.isNoTelemetryFlag = isNoTelemetryFlag;
