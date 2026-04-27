const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

require("dotenv").config();

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
