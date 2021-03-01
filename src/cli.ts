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

import Configstore from 'configstore';
import editor from 'editor';
import nopt from 'nopt';
import { prerelease, satisfies } from 'semver';
import updateNotifier from 'update-notifier';

import { CordovaLogger } from 'cordova-common';
import cordovaCreate from 'cordova-create';
import { CordovaError, cordova, events, binname } from 'cordova-lib';
import { version as libVersion } from 'cordova-lib/package.json';

import pkg from '../package.json';

import help from './help';
import { info } from './info';
import {
    hasUserOptedInOrOut,
    isCI,
    isNoTelemetryFlag,
    isOptedIn,
    showPrompt,
    track,
    turnOff as turnTelemetryOff,
    turnOn as turnTelemetryOn
} from './telemetry';

interface OptionsType {
    [k: string]: any
    argv: {
        remain: string[]
        cooked: string[]
        original: string[]
    } | Array<string>
}

const logger = CordovaLogger.get();
const conf = new Configstore(pkg.name + '-config');

// process.version is not declared writable or has no setter so storing in const for Jasmine.
const NODE_VERSION = process.version;

// When there is no node version in the deprecation stage, set to null or false.
const NODE_VERSION_REQUIREMENT = false;
const NODE_VERSION_DEPRECATING_RANGE = '<10';

const knownOpts = {
    verbose: Boolean,
    version: Boolean,
    help: Boolean,
    silent: Boolean,
    experimental: Boolean,
    noregistry: Boolean,
    nohooks: Array,
    shrinkwrap: Boolean,
    searchpath: String,
    variable: Array,
    link: Boolean,
    force: Boolean,
    'save-exact': Boolean,
    // Flags to be passed to `cordova build/run/emulate`
    debug: Boolean,
    release: Boolean,
    archs: String,
    device: Boolean,
    emulator: Boolean,
    target: String,
    noprepare: Boolean,
    nobuild: Boolean,
    list: Boolean,
    buildConfig: String,
    template: String,
    production: Boolean,
    noprod: Boolean
};

const shortHands = {
    d: '--verbose',
    v: '--version',
    h: '--help',
    t: '--template'
};

/** @throws {unknown} when errors occur with `updateNotifier` */
function checkForUpdates (): void {
    try {
        // Checks for available update and returns an instance
        const notifier = updateNotifier({ pkg: pkg });

        if (notifier.update &&
           notifier.update.latest !== pkg.version) {
            // Notify using the built-in convenience method
            notifier.notify();
        }
    } catch (e) {
        // https://issues.apache.org/jira/browse/CB-10062
        if (e && e.message && /EACCES/.test(e.message)) {
            console.log('Update notifier was not able to access the config file.\n' +
                'You may grant permissions to the file: \'sudo chmod 744 ~/.config/configstore/update-notifier-cordova.json\'');
        } else {
            throw e;
        }
    }
}

let shouldCollectTelemetry = false;

export default function (inputArgs: Array<string> = process.argv) {
    // If no inputArgs given, use process.argv.
    let cmd = inputArgs[2]; // e.g: inputArgs= 'node cordova run ios'
    const subcommand = getSubCommand(inputArgs, cmd);
    const isTelemetryCmd = (cmd === 'telemetry');
    const isConfigCmd = (cmd === 'config');

    // ToDO: Move nopt-based parsing of args up here
    if (!cmd) {
        cmd = 'help';
    } else if (cmd === '--version' || cmd === '-v') {
        cmd = 'version';
    } else if (cmd === '--help' || cmd === 'h') {
        cmd = 'help';
    }

    // If "get" is called
    if (isConfigCmd && inputArgs[3] === 'get') {
        if (inputArgs[4]) {
            logger.subscribe(events);
            conf.get(inputArgs[4]);
            if (conf.get(inputArgs[4]) !== undefined) {
                events.emit('log', conf.get(inputArgs[4]).toString());
            } else {
                events.emit('log', 'undefined');
            }
        }
    }

    // If "set" is called
    if (isConfigCmd && inputArgs[3] === 'set') {
        // I don't know what ConfigStore does if you try to 'set' undefined,
        // so returning a rejection is the most sensible thing I can think to
        // do in this situation.
        if (!inputArgs[4]) {
            return Promise.reject(new Error("'set' requires an argument"));
        }
        if (inputArgs[5] === undefined) {
            conf.set(inputArgs[4], true);
        }

        if (inputArgs[5]) {
            conf.set(inputArgs[4], inputArgs[5]);
        }
    }

    // If "delete" is called
    if (isConfigCmd && inputArgs[3] === 'delete') {
        if (inputArgs[4]) {
            conf.delete(inputArgs[4]);
        }
    }

    // If "edit" is called
    if (isConfigCmd && inputArgs[3] === 'edit') {
        editor(conf.path, (code) => {
            logger.warn('Finished editing with code ' + code);
        });
    }

    // If "ls" is called
    if (isConfigCmd && (inputArgs[3] === 'ls' || inputArgs[3] === 'list')) {
        logger.results(JSON.stringify(conf.all, null, 4));
    }

    return Promise.resolve().then((): Promise<undefined | boolean> => {
        /**
         * Skip telemetry prompt if:
         * - CI environment variable is present
         * - Command is run with `--no-telemetry` flag
         * - Command ran is: `cordova telemetry on | off | ...`
         */

        if (isCI(process.env) || isNoTelemetryFlag(inputArgs)) {
            return Promise.resolve(false);
        }

        /**
         * We shouldn't prompt for telemetry if user issues a command of the form: `cordova telemetry on | off | ...x`
         * Also, if the user has already been prompted and made a decision, use his saved answer
         */
        if (isTelemetryCmd) {
            return handleTelemetryCmd(subcommand, isOptedIn());
        }

        if (hasUserOptedInOrOut()) {
            return Promise.resolve(isOptedIn());
        }

        /**
         * Otherwise, prompt user to opt-in or out
         * Note: the prompt is shown for 30 seconds. If no choice is made by that time, User is considered to have opted out.
         */
        return showPrompt();
    }).then((collectTelemetry) => {
        shouldCollectTelemetry = collectTelemetry ?? false;
        if (isTelemetryCmd) {
            return Promise.resolve();
        }
        return cli(inputArgs);
    }).then(() => {
        if (shouldCollectTelemetry && !isTelemetryCmd) {
            track(cmd, subcommand, 'successful');
        }
    }).catch(function (err) {
        if (shouldCollectTelemetry && !isTelemetryCmd) {
            track(cmd, subcommand, 'unsuccessful');
        }
        throw err;
    });
}

const commandsWithSubCommands = new Set([
    'config',
    'platform',
    'platforms',
    'plugin',
    'plugins',
    'telemetry'
]);
function getSubCommand (args: Array<string>, cmd: string | undefined): string | null {
    if (!cmd) {
        return null;
    }
    if (commandsWithSubCommands.has(cmd)) {
        return args[3] ?? null; // e.g: args='node cordova platform rm ios', 'node cordova telemetry on'
    }
    return null;
}

function printHelp (command: string | undefined): void {
    cordova.emit('results', help(command));
}

function handleTelemetryCmd (subcommand: string | null, isOptedIn: boolean): Promise<undefined> {
    if (subcommand !== 'on' && subcommand !== 'off') {
        logger.subscribe(events);
        printHelp('telemetry');
        return Promise.resolve(undefined);
    }

    const turnOn = subcommand === 'on';
    let cmdSuccess = true;

    // turn telemetry on or off
    try {
        if (turnOn) {
            turnTelemetryOn();
            console.log('Thanks for opting into telemetry to help us improve cordova.');
        } else {
            turnTelemetryOff();
            console.log('You have been opted out of telemetry. To change this, run: cordova telemetry on.');
        }
    } catch (ex) {
        cmdSuccess = false;
    }

    // track or not track ?, that is the question

    if (!turnOn) {
        // Always track telemetry opt-outs (whether user opted out or not!)
        track('telemetry', 'off', 'via-cordova-telemetry-cmd', cmdSuccess ? 'successful' : 'unsuccessful');
        return Promise.resolve(undefined);
    }

    if (isOptedIn) {
        track('telemetry', 'on', 'via-cordova-telemetry-cmd', cmdSuccess ? 'successful' : 'unsuccessful');
    }

    return Promise.resolve(undefined);
}

interface CheckItem {
    installed: boolean;
    metadata: {
        reason: string;
        version?: {
            version?: string;
        } | string;
    };
    name: string;
}
function cli (inputArgs: Array<string>) {
    checkForUpdates();

    const args = nopt(knownOpts, shortHands, inputArgs);

    process.on('uncaughtException', (err) => {
        if (err.message) {
            logger.error(err.message);
        } else {
            logger.error(err);
        }
        // Don't send exception details, just send that it happened
        if (shouldCollectTelemetry) {
            track('uncaughtException');
        }
        process.exit(1);
    });

    logger.subscribe(events);

    if (args['silent']) {
        logger.setLevel('error');
    } else if (args['verbose']) { // can't be both silent AND verbose, silent wins
        logger.setLevel('verbose');
    }

    const cliVersion = pkg.version;
    const usingPrerelease = !!prerelease(cliVersion);
    if (args['version'] || usingPrerelease) {
        var toPrint = cliVersion;
        if (cliVersion !== libVersion || usingPrerelease) {
            toPrint += ' (cordova-lib@' + libVersion + ')';
        }

        if (args['version']) {
            logger.results(toPrint);
            return Promise.resolve(); // Important! this will return and cease execution
        } else { // must be usingPrerelease
            // Show a warning and continue
            logger.warn('Warning: using prerelease version ' + toPrint);
        }
    }

    let warningPartial = null;

    // If the Node.js versions does not meet our requirements or in a deprecation stage, display a warning.
    if (
        NODE_VERSION_REQUIREMENT &&
        !satisfies(NODE_VERSION, NODE_VERSION_REQUIREMENT)
    ) {
        warningPartial = 'is no longer supported';
    } else if (
        NODE_VERSION_DEPRECATING_RANGE &&
        satisfies(NODE_VERSION, NODE_VERSION_DEPRECATING_RANGE)
    ) {
        warningPartial = 'has been deprecated';
    }

    if (warningPartial) {
        const upgradeMsg = 'Please upgrade to the latest Node.js version available (LTS version recommended).';
        logger.warn(`Warning: Node.js ${NODE_VERSION} ${warningPartial}. ${upgradeMsg}`);
    }

    // If there were arguments protected from nopt with a double dash, keep
    // them in unparsedArgs. For example:
    // cordova build ios -- --verbose --whatever
    // In this case "--verbose" is not parsed by nopt and args.vergbose will be
    // false, the unparsed args after -- are kept in unparsedArgs and can be
    // passed downstream to some scripts invoked by Cordova.
    let unparsedArgs: Array<string> = [];
    const parseStopperIdx = args.argv.original.indexOf('--');
    if (parseStopperIdx !== -1) {
        unparsedArgs = args.argv.original.slice(parseStopperIdx + 1);
    }

    // args.argv.remain contains both the undashed args (like platform names)
    // and whatever unparsed args that were protected by " -- ".
    // "undashed" stores only the undashed args without those after " -- " .
    const remain = args.argv.remain;
    const undashed = remain.slice(0, remain.length - unparsedArgs.length);
    const cmd = undashed[0];
    let subcommand;

    if (!cmd || cmd === 'help' || args['help']) {
        if (!args['help'] && remain[0] === 'help') {
            remain.shift();
        }
        return printHelp(remain[0]);
    }

    if (cmd === 'info') return info();

    // Don't need to do anything with cordova-lib since config was handled above
    if (cmd === 'config') return true;

    if (cmd === 'create') {
        const [, dest, id, name] = undashed;
        return cordovaCreate(dest, { id, name, events, template: args['template'] });
    }

    if (!Object.prototype.hasOwnProperty.call(cordova, cmd)) {
        const msg2 = 'Cordova does not know ' + cmd + '; try `' + binname +
            ' help` for a list of all the available commands.';
        throw new CordovaError(msg2);
    }

    const opts = {
        platforms: [] as Array<string>,
        options: {

        } as OptionsType,
        verbose: (args['verbose'] ?? false) as boolean,
        silent: (args['silent'] ?? false) as boolean,
        nohooks: (args['nohooks'] ?? []) as Array<unknown>,
        searchpath: args['searchpath']
    };

    const platformCommands = new Set(['emulate', 'build', 'prepare', 'compile', 'run', 'clean']);
    if (platformCommands.has(cmd)) {
        // All options without dashes are assumed to be platform names
        opts.platforms = undashed.slice(1);

        // Pass nopt-parsed args to PlatformApi through opts.options
        opts.options = args;
        opts.options.argv = unparsedArgs;
        if (cmd === 'run' && args['list'] && cordova.targets) {
            return cordova.targets.call(null, opts);
        }
        return cordova[cmd].call(null, opts);
    } else if (cmd === 'requirements') {
        // All options without dashes are assumed to be platform names
        opts.platforms = undashed.slice(1);

        return cordova[cmd].call(null, opts.platforms)
            .then((platformChecks: Record<string, Array<CheckItem> | CordovaError>) => {
                const someChecksFailed = Object.keys(platformChecks).map(function (platformName) {
                    events.emit('log', '\nRequirements check results for ' + platformName + ':');
                    const platformCheck = platformChecks[platformName];
                    if (platformCheck instanceof CordovaError) {
                        events.emit('warn', 'Check failed for ' + platformName + ' due to ' + platformCheck);
                        return true;
                    }

                    let someChecksFailed = false;

                    // platformCheck is expected to be an array of conditions that must be met
                    // the browser platform currently returns nothing, which was breaking here.
                    if (platformCheck && platformCheck.forEach) {
                        platformCheck.forEach(function (checkItem) {
                            let checkSummary = checkItem.name + ': ';
                            if (checkItem.installed) {
                                checkSummary += 'installed ';
                                if (typeof checkItem.metadata.version === 'object') {
                                    checkSummary += checkItem.metadata.version.version;
                                } else {
                                    checkSummary += checkItem.metadata.version;
                                }
                            } else {
                                checkSummary += 'not installed '; // trailing space was as-designed
                            }
                            events.emit('log', checkSummary);
                            if (!checkItem.installed) {
                                someChecksFailed = true;
                                events.emit('warn', checkItem.metadata.reason);
                            }
                        });
                    }
                    return someChecksFailed;
                }).some(isCheckFailedForPlatform => isCheckFailedForPlatform);

                if (someChecksFailed) {
                    throw new CordovaError('Some of requirements check failed');
                }
            });
    } else if (cmd === 'serve') {
        return cordova.serve(undashed[1]);
    } else {
        // platform/plugins add/rm [target(s)]
        subcommand = undashed[1]; // sub-command like "add", "ls", "rm" etc.
        const targets = undashed.slice(2); // array of targets, either platforms or plugins
        const cli_vars: Record<string, string> = {};
        if (args['variable']) {
            args['variable'].forEach((strVar: string) => {
                // CB-9171
                const keyVal = strVar.split('=');
                if (keyVal.length < 2) {
                    throw new CordovaError('invalid variable format: ' + strVar);
                } else {
                    // check above covers if `keyVal.shift()` were undefined
                    const key = (keyVal.shift() as string).toUpperCase();
                    const val = keyVal.join('=');
                    cli_vars[key] = val;
                }
            });
        }

        args['save'] = !args['nosave'];
        args['production'] = !args['noprod'];

        if (args['searchpath'] === undefined) {
            // User explicitly did not pass in searchpath
            args['searchpath'] = conf.get('searchpath');
        }
        if (args['save-exact'] === undefined) {
            // User explicitly did not pass in save-exact
            args['save-exact'] = conf.get('save-exact');
        }

        const download_opts = {
            searchpath: args['searchpath'],
            noregistry: args['noregistry'],
            nohooks: args['nohooks'],
            cli_variables: cli_vars,
            link: args['link'] || false,
            save: args['save'],
            save_exact: args['save-exact'] || false,
            shrinkwrap: args['shrinkwrap'] || false,
            force: args['force'] || false,
            production: args['production']
        };
        return cordova[cmd](subcommand, targets, download_opts);
    }
}
