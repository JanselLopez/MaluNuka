const fs = require("node:fs");

const bundlePath = require.resolve("react-native-peer");
const source = fs.readFileSync(bundlePath, "utf8");
const bundleMarker = "parcelRequire=function(";
const bundleStart = source.indexOf(bundleMarker);

if (bundleStart < 0) {
  throw new Error(`Unexpected react-native-peer bundle format: ${bundlePath}`);
}

if (!/\bvar\s+parcelRequire\b/.test(source.slice(0, bundleStart))) {
  fs.writeFileSync(
    bundlePath,
    source.slice(0, bundleStart) + "var parcelRequire;\n" + source.slice(bundleStart),
  );
}

console.log("Applied React Native Parcel runtime compatibility fix.");
