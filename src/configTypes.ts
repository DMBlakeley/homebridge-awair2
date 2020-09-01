export type onlyAwairPlatformConfig = {
  platform: string;
  token: string;
  userType: string;
  airQualityMethod: string;
  endpoint: string;
  polling_interval: number;
  limit: number;
  logging: boolean;
  carbonDioxideThreshold: number;
  carbonDioxideThresholdOff: number;
  numDevices: number;
};

export type DeviceConfig = {
  name: string;
  macAddress: string;
  latitude: number;
  preference: string;
  timezone: string;
  roomType: string;
  deviceType: string;
  longitude: number;
  spaceType: string;
  deviceUUID: string;
  deviceId: number;
  locationName: string;
};

/*
export type AwairPlatformConfig = {
  name: string;
  token: string;
  manufacturer: string;
  model: string;
  devType: string;
  devId: string;
  serial: string;
  deviceUUID: string;
  carbonDioxideThreshold: number;
  carbonDioxideThresholdOff: number;
  vocMw: number;
  airQualityMethod: string;
  endpoint: string;
  polling_interval: number;
  userType: string;
  limit: number;
  logging: boolean;
  numDevice: number;
};
*/
