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

import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import type { PathLike } from 'fs';
import { join } from 'path';
import { osInfo } from 'systeminformation';
import { cordova, cordova_platforms } from 'cordova-lib';
import { getInstalledPlatformsWithVersions } from "cordova-lib/src/cordova/util";
import { getInstalledPlugins as cdvGetInstalledPlugins } from "cordova-lib/src/cordova/plugin/util";

const getPlatformApi = cordova_platforms.getPlatformApi;

import cliPkg from "../package.json";
import libPkg from "cordova-lib/package.json";

const cdvLibUtil = require('cordova-lib/src/cordova/util');

// Cache
let _installedPlatformsList: Record<string, string> | null = null;

/*
 * Sections
 */

async function getCordovaDependenciesInfo (): Promise<DependencyInfo> {
    // get self "Cordova CLI"
    const cliDependencies = await _getLibDependenciesInfo(cliPkg.dependencies);

    const cliLibDep = cliDependencies.find(({ key }) => key === 'lib');
    // the old code would've thrown a TypeError on `children` property access,
    // so I feel pretty good about adding this manual `throw`.
    if (!cliLibDep) {
        throw new Error("found no dependency on 'cordova-lib' in CLI package definition");
    }
    cliLibDep.children = await _getLibDependenciesInfo(libPkg.dependencies);

    return {
        key: 'Cordova Packages',
        children: [{
            key: 'cli',
            value: cliPkg.version,
            children: cliDependencies
        }]
    };
}

async function getInstalledPlatforms (projectRoot: string): Promise<DependencyInfo> {
    return _getInstalledPlatforms(projectRoot).then(platforms => {
        const key = 'Project Installed Platforms';
        const children = Object.entries(platforms)
            .map(([key, value]) => ({ key, value }));

        return { key, children };
    });
}

interface PluginInfo {
    key: string;
    children: Array<{
        key: string | undefined;
        value: string | undefined;
    }>;
}
async function getInstalledPlugins (projectRoot: string): Promise<PluginInfo> {
    const key = 'Project Installed Plugins';
    const children = cdvGetInstalledPlugins(projectRoot)
        .map(plugin => ({ key: plugin.id, value: plugin.version }));

    return { key, children };
}

interface EnvironmentInfo {
    key: 'Environment',
    children: Array<{
        key: string;
        value: string;
    }>;
}
async function getEnvironmentInfo (): Promise<EnvironmentInfo> {
    const [npmVersion, osInfoResult] = await Promise.all([_getNpmVersion(), osInfo()]);
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
}

async function getPlatformEnvironmentData (projectRoot: string): Promise<Array<Promise<NodeList>>> {
    const installedPlatforms = await _getInstalledPlatforms(projectRoot);

    return Object.keys(installedPlatforms)
        .map(platform => {
            const platformApi = getPlatformApi(platform);

            let getPlatformInfo;
            if (platformApi && platformApi.getEnvironmentInfo) {
                getPlatformInfo = platformApi.getEnvironmentInfo();
            } else if (platform === "ios") {
                getPlatformInfo = _legacyPlatformInfo.ios;
            } else if (platform === "android") {
                getPlatformInfo = _legacyPlatformInfo.android;
            } else {
                getPlatformInfo = false;
            }

            return { platform, getPlatformInfo };
        })
        .filter(o => o.getPlatformInfo)
        .map(async ({ platform, getPlatformInfo }) => ({
            key: `${platform} Environment`,
            children: await (getPlatformInfo as ()=>Promise<{key: string, value: string}[]>)()
        }));
}

async function getProjectSettingsFiles (projectRoot: string) {
    const cfgXml = _fetchFileContents(cdvLibUtil.projectConfig(projectRoot));

    // Create package.json snippet
    const pkgJson = require(join(projectRoot, 'package'));
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
}

/*
 * Section Data Helpers
 */

interface DependencyInfo {
    children?: Array<DependencyInfo>;
    key: string | undefined;
    value?: string;
}
async function _getLibDependenciesInfo (dependencies: Record<string, string>): Promise<Array<DependencyInfo>> {
    const cordovaPrefix = 'cordova-';

    return Object.keys(dependencies)
        .filter(name => name.startsWith(cordovaPrefix))
        // programmatic `require`s can't be written as `import`s. The only
        // other way to do this is with a `readFile` call, which would be a
        // hassle compared to the automatic resolution provided by `require`.
        .map(name => ({ key: name.slice(cordovaPrefix.length), value: require(`${name}/package`).version }));
}

async function _getInstalledPlatforms (projectRoot: string): Promise<Record<string, string>> {
    if (!_installedPlatformsList) {
        _installedPlatformsList = await getInstalledPlatformsWithVersions(projectRoot);
    }
    return _installedPlatformsList;
}

async function _getNpmVersion (): Promise<string> {
    return new Promise((resolve, reject) => {
        exec('npm -v', (err, stdout, stderr) => {
            if (stderr !== "") {
                console.error("'npm -v' stderr:", stderr);
            }
            if (err) {
                reject(err);
            } else {
                resolve(stdout);
            }
        });
    });
}

function _fetchFileContents (filePath: PathLike): string {
    if (!existsSync(filePath)) return 'File Not Found';

    return readFileSync(filePath, 'utf-8');
}

/**
 * @deprecated will be removed when platforms implement the calls.
 */
const _legacyPlatformInfo = {
    ios: async () => [{
        key: 'xcodebuild',
        value: await _failSafeSpawn(['xcodebuild', '-version'])
    }],
    android: async () => [{
        key: 'android',
        value: await _failSafeSpawn(['avdmanager', 'list', 'target'])
    }]
};

async function _failSafeSpawn(args: Array<string>): Promise<string>{
    return new Promise((resolve) => {
        exec(args.join(" "),
            (err, stdout) => {
                if (err) {
                    resolve(`ERROR: ${err.message}`);
                }
                resolve(stdout);
            }
        );
    });
}

interface NodeList {
    children?: Array<NodeList>;
    key: unknown;
    value?: string;
}
function _formatNodeList (list: Array<NodeList>, level = 0): Array<string> {
    const content = [];

    for (const item of list) {
        const indent = String.prototype.padStart((4 * level), ' ');
        let itemString = `${indent}${item.key}:`;

        if (item.value) {
            // Pad multi-line values with a new line on either end
            itemString += (/[\r\n]/.test(item.value))
                ? `\n${item.value.trim()}\n`
                : ` ${item.value}`;
        } else {
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

export const projectRoot = cdvLibUtil.cdProjectRoot();
export const results = async ()=> {
    const promises: Array<Promise<NodeList>> = [
        getCordovaDependenciesInfo(),
        getInstalledPlatforms(projectRoot),
        getInstalledPlugins(projectRoot),
        getEnvironmentInfo(),
        ...(await getPlatformEnvironmentData(projectRoot)),
        getProjectSettingsFiles(projectRoot)
    ];
    return Promise.all(promises);
}
export const content = async()=>_formatNodeList(await results());

export async function info(): Promise<Array<string>> {
    const cont = await content();
    cordova.emit('results', cont.join('\n'));
    return cont;
}
info();
