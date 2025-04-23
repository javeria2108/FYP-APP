// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require("nativewind/metro");
/** @type {import('expo/metro-config').MetroConfig} */

const config = getDefaultConfig(__dirname, 
    { isCSSEnabled: true });


    // Extend the default asset extensions to include `.bin`
    config.resolver.assetExts.push('bin');



module.exports =  withNativeWind(config, { input: "./global.css" });
