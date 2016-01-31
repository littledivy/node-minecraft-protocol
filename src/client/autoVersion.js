'use strict';

var ping = require('../ping');
var debug = require('../debug');
var states = require('../states');
var assert = require('assert');
var minecraft_data = require('minecraft-data');

// Get the minecraft-data version string for a protocol version
// TODO: add to node-minecraft-data index (protocol to newest release, if multiple)
function protocolVersion2MinecraftVersion(n) {
  var usesNetty = n > 0;
  for (var i = 0; i < minecraft_data.versions.length; ++i) {
    var version = minecraft_data.versions[i];
    if (version.version === Math.abs(n) && version.usesNetty === usesNetty) {
      console.log(version);
      return [version.minecraftVersion, version.majorVersion];
    }
  }

  throw new Error(`unsupported/unknown protocol version: ${n}, update minecraft-data`);
}

module.exports = function(client) {
  var options = client.options;

  debug('creating client');
  options.wait_connect = true; // don't let src/client/setProtocol proceed on socket 'connect' until 'connect_allowed'
  debug('pinging',options.host);
  // TODO: detect ping timeout, https://github.com/PrismarineJS/node-minecraft-protocol/issues/329
  ping(options, function(err, response) {
    if (err) throw err; // hmm
    debug('ping response',response);
    // TODO: could also use ping pre-connect to save description, type, negotiate protocol etc.
    //  ^ see https://github.com/PrismarineJS/node-minecraft-protocol/issues/327
    var motd = response.description;
    debug('Server description:',motd); // TODO: save

    // Pass server-reported version to protocol handler
    // The version string is interpereted by https://github.com/PrismarineJS/node-minecraft-data
    var minecraftVersion = response.version.name;        // 1.8.9, 1.7.10
    var protocolVersion = response.version.protocol;//    47,      5

    debug(`Server version: ${minecraftVersion}, protocol: ${protocolVersion}`);
    // Note that versionName is a descriptive version stirng like '1.8.9' on vailla, but other
    // servers add their own name (Spigot 1.8.8, Glowstone++ 1.8.9) so we cannot use it directly,
    // even though it is in a format accepted by minecraft-data. Instead, translate the protocol.
    var [minecraftVersion, majorVersion] = protocolVersion2MinecraftVersion(protocolVersion);
    client.options.version = minecraftVersion;

    // Use the exact same protocol version
    // Requires https://github.com/PrismarineJS/node-minecraft-protocol/pull/330
    client.options.protocolVersion = protocolVersion;

    // reinitialize client object with new version TODO: move out of its constructor
    client.version = majorVersion;
    client.setSerializer(states.HANDSHAKING);

    if (response.modinfo && response.modinfo.type === 'FML') {
      // Use the list of Forge mods from the server ping, so client will match server
      var forgeMods = response.modinfo.modList;
      debug('Using forgeMods:',forgeMods);
      // TODO: https://github.com/PrismarineJS/node-minecraft-protocol/issues/114
      //  https://github.com/PrismarineJS/node-minecraft-protocol/pull/326
      // TODO: modify client object to set forgeMods and enable forgeHandshake
      throw new Error('FML/Forge not yet supported');
    }
    // done configuring client object, let connection proceed
    client.emit('connect_allowed');
  });
  return client;
}
