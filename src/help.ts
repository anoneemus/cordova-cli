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
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { binname } from 'cordova_lib';

/**
 * help finds a help file for something and returns its contents.
 *
 * @param arg The name of the help topic to display. The files checked for help
 * text are, in order, `{arg}.md`, `{arg}.txt`, `cordova.md`, and `cordova.txt`
 * in `../doc/` (relative to the process CWD).
 * @returns The contents of the chosen help file, if any are found.
 * @throws {Error} If no help file can be found.
 */
export function help (arg: string = 'cordova'): string {
    const docdir = join(__dirname, '..', 'doc');
    const file = [
        arg + '.md',
        arg + '.txt',
        'cordova.md',
        'cordova.txt'
	].map((file_name) => {
        const f = join(docdir, file_name);
        if (existsSync(f)) {
            return f;
        }
	}).filter((f) => f);
    return readFileSync(file[0], "utf8").replace(/cordova-cli/g, binname);
};
