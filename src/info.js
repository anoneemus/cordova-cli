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
exports.info = exports.content = exports.results = exports.projectRoot = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const systeminformation_1 = require("systeminformation");
const cordova_lib_1 = require("cordova-lib");
const util_1 = require("cordova-lib/src/cordova/util");
const util_2 = require("cordova-lib/src/cordova/plugin/util");
const getPlatformApi = cordova_lib_1.cordova_platforms.getPlatformApi;
const package_json_1 = __importDefault(require("../package.json"));
const package_json_2 = __importDefault(require("cordova-lib/package.json"));
const cdvLibUtil = require('cordova-lib/src/cordova/util');
// Cache
let _installedPlatformsList = null;
/*
 * Sections
 */
function getCordovaDependenciesInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        // get self "Cordova CLI"
        const cliDependencies = yield _getLibDependenciesInfo(package_json_1.default.dependencies);
        const cliLibDep = cliDependencies.find(({ key }) => key === 'lib');
        // the old code would've thrown a TypeError on `children` property access,
        // so I feel pretty good about adding this manual `throw`.
        if (!cliLibDep) {
            throw new Error("found no dependency on 'cordova-lib' in CLI package definition");
        }
        cliLibDep.children = yield _getLibDependenciesInfo(package_json_2.default.dependencies);
        return {
            key: 'Cordova Packages',
            children: [{
                    key: 'cli',
                    value: package_json_1.default.version,
                    children: cliDependencies
                }]
        };
    });
}
function getInstalledPlatforms(projectRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        return _getInstalledPlatforms(projectRoot).then(platforms => {
            const key = 'Project Installed Platforms';
            const children = Object.entries(platforms)
                .map(([key, value]) => ({ key, value }));
            return { key, children };
        });
    });
}
function getInstalledPlugins(projectRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = 'Project Installed Plugins';
        const children = util_2.getInstalledPlugins(projectRoot)
            .map(plugin => ({ key: plugin.id, value: plugin.version }));
        return { key, children };
    });
}
function getEnvironmentInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        const [npmVersion, osInfoResult] = yield Promise.all([_getNpmVersion(), systeminformation_1.osInfo()]);
        const { platform, distro, release, codename, kernel, arch, build } = osInfoResult;
        const optionalBuildSuffix = build ? ` (${build})` : '';
        const osFormat = [
            platform === 'darwin' ? codename : distro,
            release + optionalBuildSuffix,
            `(${platform} ${kernel})`,
            `${arch}`
        ];
        return {
            key: 'Environment',
            children: [
                { key: 'OS', value: osFormat.join(' ') },
                { key: 'Node', value: process.version },
                { key: 'npm', value: npmVersion }
            ]
        };
    });
}
function getPlatformEnvironmentData(projectRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        const installedPlatforms = yield _getInstalledPlatforms(projectRoot);
        return Object.keys(installedPlatforms)
            .map(platform => {
            const platformApi = getPlatformApi(platform);
            let getPlatformInfo;
            if (platformApi && platformApi.getEnvironmentInfo) {
                getPlatformInfo = platformApi.getEnvironmentInfo();
            }
            else if (platform === "ios") {
                getPlatformInfo = _legacyPlatformInfo.ios;
            }
            else if (platform === "android") {
                getPlatformInfo = _legacyPlatformInfo.android;
            }
            else {
                getPlatformInfo = false;
            }
            return { platform, getPlatformInfo };
        })
            .filter(o => o.getPlatformInfo)
            .map(({ platform, getPlatformInfo }) => __awaiter(this, void 0, void 0, function* () {
            return ({
                key: `${platform} Environment`,
                children: yield getPlatformInfo()
            });
        }));
    });
}
function getProjectSettingsFiles(projectRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        const cfgXml = _fetchFileContents(cdvLibUtil.projectConfig(projectRoot));
        // Create package.json snippet
        const pkgJson = require(path_1.join(projectRoot, 'package'));
        const pkgSnippet = [
            '--- Start of Cordova JSON Snippet ---',
            JSON.stringify(pkgJson.cordova, null, 2),
            '--- End of Cordova JSON Snippet ---'
        ].join('\n');
        return {
            key: 'Project Setting Files',
            children: [
                { key: 'config.xml', value: `${cfgXml}` },
                { key: 'package.json', value: pkgSnippet }
            ]
        };
    });
}
function _getLibDependenciesInfo(dependencies) {
    return __awaiter(this, void 0, void 0, function* () {
        const cordovaPrefix = 'cordova-';
        return Object.keys(dependencies)
            .filter(name => name.startsWith(cordovaPrefix))
            // programmatic `require`s can't be written as `import`s. The only
            // other way to do this is with a `readFile` call, which would be a
            // hassle compared to the automatic resolution provided by `require`.
            .map(name => ({ key: name.slice(cordovaPrefix.length), value: require(`${name}/package`).version }));
    });
}
function _getInstalledPlatforms(projectRoot) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!_installedPlatformsList) {
            _installedPlatformsList = yield util_1.getInstalledPlatformsWithVersions(projectRoot);
        }
        return _installedPlatformsList;
    });
}
function _getNpmVersion() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            child_process_1.exec('npm -v', (err, stdout, stderr) => {
                if (stderr !== "") {
                    console.error("'npm -v' stderr:", stderr);
                }
                if (err) {
                    reject(err);
                }
                else {
                    resolve(stdout);
                }
            });
        });
    });
}
function _fetchFileContents(filePath) {
    if (!fs_1.existsSync(filePath))
        return 'File Not Found';
    return fs_1.readFileSync(filePath, 'utf-8');
}
/**
 * @deprecated will be removed when platforms implement the calls.
 */
const _legacyPlatformInfo = {
    ios: () => __awaiter(void 0, void 0, void 0, function* () {
        return [{
                key: 'xcodebuild',
                value: yield _failSafeSpawn(['xcodebuild', '-version'])
            }];
    }),
    android: () => __awaiter(void 0, void 0, void 0, function* () {
        return [{
                key: 'android',
                value: yield _failSafeSpawn(['avdmanager', 'list', 'target'])
            }];
    })
};
function _failSafeSpawn(args) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve) => {
            child_process_1.exec(args.join(" "), (err, stdout) => {
                if (err) {
                    resolve(`ERROR: ${err.message}`);
                }
                resolve(stdout);
            });
        });
    });
}
function _formatNodeList(list, level = 0) {
    const content = [];
    for (const item of list) {
        const indent = String.prototype.padStart((4 * level), ' ');
        let itemString = `${indent}${item.key}:`;
        if (item.value) {
            // Pad multi-line values with a new line on either end
            itemString += (/[\r\n]/.test(item.value))
                ? `\n${item.value.trim()}\n`
                : ` ${item.value}`;
        }
        else {
            // Start of section
            itemString = `\n${itemString}\n`;
        }
        content.push(itemString);
        if (item.children) {
            content.push(..._formatNodeList(item.children, level + 1));
        }
    }
    return content;
}
exports.projectRoot = cdvLibUtil.cdProjectRoot();
const results = () => __awaiter(void 0, void 0, void 0, function* () {
    const promises = [
        getCordovaDependenciesInfo(),
        getInstalledPlatforms(exports.projectRoot),
        getInstalledPlugins(exports.projectRoot),
        getEnvironmentInfo(),
        ...(yield getPlatformEnvironmentData(exports.projectRoot)),
        getProjectSettingsFiles(exports.projectRoot)
    ];
    return Promise.all(promises);
});
exports.results = results;
const content = () => __awaiter(void 0, void 0, void 0, function* () { return _formatNodeList(yield exports.results()); });
exports.content = content;
function info() {
    return __awaiter(this, void 0, void 0, function* () {
        const cont = yield exports.content();
        cordova_lib_1.cordova.emit('results', cont.join('\n'));
        return cont;
    });
}
exports.info = info;
info();
