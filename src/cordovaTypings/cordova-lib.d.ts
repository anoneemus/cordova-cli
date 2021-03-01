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

declare module 'cordova-lib/src/cordova/util' {
    const binname: string;
    function listPlatforms (project_dir: string): Array<string>;
    async function getInstalledPlatformsWithVersions(project_dir: string): Promise<Record<string, string>>;
}

declare module 'cordova-lib/src/cordova/plugin/util' {
    class PluginInfo {
        public id: string | undefined;
        public version: string | undefined;
        constructor (dirname: string);
        private _getTags(tag: string, platform: string | Array<string>): unknown;
    }
    class PluginInfoProvider {
        constructor();
        public _cache: Record<string, PluginInfo>;
        public _getAllCache: Record<string, Array<PluginInfo>>;
        public getAllWithinSearchPath(dirName: string): Array<PluginInfo>;
    }
    function getInstalledPlugins(projectRoot: string): Array<PluginInfo>;
}

declare module 'cordova-lib' {
	/** The name of the Cordova binary (as executed by the user, presumably) */
	const binname: string;

    declare module 'cordova_platforms' {
        function getPlatformApi(platform, platformRootDir?: string): Record<string, object | string>
    }
}
