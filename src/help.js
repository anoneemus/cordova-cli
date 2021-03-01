"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.help = void 0;
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
const fs_1 = require("fs");
const path_1 = require("path");
const cordova_lib_1 = require("cordova-lib");
/**
 * help finds a help file for something and returns its contents.
 *
 * @param arg The name of the help topic to display. The files checked for help
 * text are, in order, `{arg}.md`, `{arg}.txt`, `cordova.md`, and `cordova.txt`
 * in `../doc/` (relative to the process CWD).
 * @returns The contents of the chosen help file, if any are found.
 * @throws {Error} If no help file can be found.
 */
function help(arg = 'cordova') {
    const docdir = path_1.join(__dirname, '..', 'doc');
    const file = [
        arg + '.md',
        arg + '.txt',
        'cordova.md',
        'cordova.txt'
    ].map(file_name => path_1.join(docdir, file_name)).filter(f => fs_1.existsSync(f));
    if (!file[0]) {
        throw new Error(`no help files found for '${arg}'`);
    }
    return fs_1.readFileSync(file[0], "utf8").replace(/cordova-cli/g, cordova_lib_1.binname);
}
exports.help = help;
;
