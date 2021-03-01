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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cli = exports.cordova_lib = void 0;
// All cordova js API moved to cordova-lib. If you don't need the cordova CLI,
// use cordova-lib directly.
const cordova_lib_1 = __importDefault(require("cordova-lib"));
const cli_1 = __importDefault(require("./src/cli"));
__exportStar(require("cordova-lib/src/cordova/cordova"), exports);
// Also export the cordova-lib so that downstream consumers of cordova lib and
// CLI will be able to use CLI's cordova-lib and avoid the risk of having two
// different versions of cordova-lib which would result in two instances of
// "events" and can cause bad event handling.
exports.cordova_lib = cordova_lib_1.default;
exports.cli = cli_1.default;
