/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const remittance = require('./lib/remittance.js');

module.exports.Remittance = remittance;
module.exports.contracts = [remittance];
