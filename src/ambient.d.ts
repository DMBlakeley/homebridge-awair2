// Workaround for "node_modules/hap-nodejs/dist/lib/Advertiser.d.ts:5:29 - error TS7016: Could not find a declaration file for module 
//   '@homebridge/dbus-native'. '…/node_modules/@homebridge/dbus-native/index.js' implicitly has an 'any' type."
declare module '@homebridge/dbus-native' {
  type InvokeError = unknown
}