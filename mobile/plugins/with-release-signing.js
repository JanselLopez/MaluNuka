// Firma la versión "release" con la llave de la carpeta firma/ del proyecto (fuera de Git).
// Si la carpeta no existe, la compilación sigue con la llave de pruebas de siempre.
const { withAppBuildGradle } = require("expo/config-plugins");

const BLOCK = `
def firmaProps = new Properties()
def firmaFile = rootProject.file("../../firma/keystore.properties")
if (firmaFile.exists()) firmaFile.withInputStream { firmaProps.load(it) }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let g = mod.modResults.contents;
    if (g.includes("firmaProps")) return mod;
    g = g.replace(/^android \{/m, BLOCK + "\nandroid {");
    g = g.replace(/signingConfigs \{\n(\s*)debug \{/, (m, sp) => `signingConfigs {
${sp}if (firmaFile.exists()) {
${sp}    release {
${sp}        storeFile new File(firmaFile.parentFile, new File(firmaProps["storeFile"]).name)
${sp}        storePassword firmaProps["storePassword"]
${sp}        keyAlias firmaProps["keyAlias"]
${sp}        keyPassword firmaProps["keyPassword"]
${sp}    }
${sp}}
${sp}debug {`);
    g = g.replace(/(release \{[^}]*?)signingConfig signingConfigs\.debug/, "$1signingConfig firmaFile.exists() ? signingConfigs.release : signingConfigs.debug");
    mod.modResults.contents = g;
    return mod;
  });
};
