const { withInfoPlist } = require("expo/config-plugins");

module.exports = function withDataOnlyWebRTC(config) {
  return withInfoPlist(config, (mod) => {
    delete mod.modResults.NSCameraUsageDescription;
    delete mod.modResults.NSMicrophoneUsageDescription;
    return mod;
  });
};
