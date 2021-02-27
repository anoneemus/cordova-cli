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

// For further details on telemetry, see:
// https://github.com/cordova/cordova-discuss/pull/43

// Google Analytics tracking code
const GA_TRACKING_CODE = 'UA-64283057-7';

import { EOL } from "os";
import Insight from 'insight';
import pkg from '../package.json';

/**
 * By redefining `get optOut` we trick Insight into tracking
 * even though the user might have opted out.
 *
 * @todo The discussion on #43 specifically mentions that users should be able
 * to opt out - so why not allow them?
 */
class RelentlessInsight extends Insight {
    public _permissionTimeout = 30;
    // This class is unexported and `getOpt` is never accessed, so I don't
    // think this actually did anything.
    // get optOut () { return false; }
    // set optOut (value) { super.optOut = value; }

    // get realOptOut () { return super.optOut; }
}

const insight = new RelentlessInsight({
    trackingCode: GA_TRACKING_CODE,
    pkg: pkg
});

export let timeoutInSecs = 30;

/**
 * Prompts the user to allow telemetry, and returns their response.
 *
 * @returns `true` if the user opted in, and `false` otherwise.
 */
export async function showPrompt (): Promise<boolean> {
    return new Promise(resolve => {
        const msg = 'May Cordova anonymously report usage statistics to improve the tool over time?';
        insight._permissionTimeout = timeoutInSecs || 30;
        insight.askPermission(msg, (_: unknown, optIn: boolean) => {
            if (optIn) {
                console.log(EOL + 'Thanks for opting into telemetry to help us improve cordova.');
                track('telemetry', 'on', 'via-cli-prompt-choice', 'successful');
            } else {
                console.log(EOL + 'You have been opted out of telemetry. To change this, run: cordova telemetry on.');
                // Always track telemetry opt-outs! (whether opted-in or opted-out)
                track('telemetry', 'off', 'via-cli-prompt-choice', 'successful');
            }
            resolve(optIn);
        });
    });
}

export function track (...args: Array<string>): void {
    // Remove empty, null or undefined strings from arguments
    const filteredArgs = args.filter(val => val && val.length !== 0);
    insight.track(...filteredArgs);
}

/** Turns on telemetry. */
export function turnOn (): void {
    insight.optOut = false;
}

/** Turns off telemetry. */
export function turnOff () {
    insight.optOut = true;
}

/**
 * Clears telemetry setting
 * Has the same effect as if user never answered the telemetry prompt
 * Useful for testing purposes
 */
export function clear (): void {
    // optOut is modeled as a boolean, but can apparently be undefined.
    insight.optOut = undefined as unknown as boolean;
}

/**
 * Returns whether or not the user has opted into telemetry.
 */
export function isOptedIn (): boolean {
    return !insight.optOut;
}

/**
 * Has the user already answered the telemetry prompt? (thereby opting in or out?)
 */
export function hasUserOptedInOrOut (): boolean {
    return insight.optOut !== undefined;
}

/**
 * Is the environment variable 'CI' specified ?
 */
export function isCI (env: Record<string, unknown>): env is Record<string, unknown> & Record<"CI", unknown> {
    return "CI" in env;
}

/**
 * Has the user ran a command of the form: `cordova run --no-telemetry` ?
 */
export function isNoTelemetryFlag (args: Array<string>): boolean {
    return args.indexOf('--no-telemetry') > -1;
}
