import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alignmate.csu',
  appName: 'AlignMate CSU',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  // Include model files in the build
  includePlugins: [
    '@capacitor/filesystem',
    '@capacitor/camera',
    '@capacitor/network'
  ]
};

export default config;
