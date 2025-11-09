/**
 * Capacitor File System Helper for Mobile Apps
 * Provides model loading for iOS and Android apps
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export class CapacitorModelLoader {
  /**
   * Check if running on native mobile platform
   */
  static isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Get model path for current platform
   */
  static async getModelPath(modelName: string): Promise<string> {
    if (!this.isNativePlatform()) {
      // Web platform - use public directory
      return `/models/${modelName}`;
    }

    // Native platform - copy from assets to data directory
    try {
      // Check if model exists in data directory
      const dataPath = `models/${modelName}`;
      
      try {
        await Filesystem.stat({
          path: dataPath,
          directory: Directory.Data
        });
        
        // Model exists in data directory
        const uri = await Filesystem.getUri({
          path: dataPath,
          directory: Directory.Data
        });
        
        return uri.uri;
      } catch {
        // Model doesn't exist in data directory, need to copy from assets
        console.log(`Copying ${modelName} from assets to data directory...`);
        
        // Read from assets (bundled with app)
        const assetData = await Filesystem.readFile({
          path: `public/models/${modelName}`,
          directory: Directory.Data // This will be overridden by asset bundling
        });
        
        // Write to data directory
        await Filesystem.writeFile({
          path: dataPath,
          data: assetData.data,
          directory: Directory.Data,
          recursive: true
        });
        
        const uri = await Filesystem.getUri({
          path: dataPath,
          directory: Directory.Data
        });
        
        console.log(`✅ Model copied to: ${uri.uri}`);
        return uri.uri;
      }
    } catch (error) {
      console.error('Error loading model on native platform:', error);
      // Fallback to web path
      return `/models/${modelName}`;
    }
  }

  /**
   * Load model blob for ONNX Runtime
   */
  static async loadModelBlob(modelName: string): Promise<ArrayBuffer> {
    if (!this.isNativePlatform()) {
      // Web platform - use fetch
      const response = await fetch(`/models/${modelName}`);
      if (!response.ok) {
        throw new Error(`Failed to load model: ${response.statusText}`);
      }
      return await response.arrayBuffer();
    }

    // Native platform
    try {
      const dataPath = `models/${modelName}`;
      
      const fileData = await Filesystem.readFile({
        path: dataPath,
        directory: Directory.Data
      });
      
      // Convert base64 to ArrayBuffer
      const base64 = fileData.data as string;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes.buffer;
    } catch (error) {
      console.error('Error reading model file:', error);
      throw error;
    }
  }

  /**
   * Check if model exists
   */
  static async modelExists(modelName: string): Promise<boolean> {
    if (!this.isNativePlatform()) {
      try {
        const response = await fetch(`/models/${modelName}`, { method: 'HEAD' });
        return response.ok;
      } catch {
        return false;
      }
    }

    try {
      await Filesystem.stat({
        path: `models/${modelName}`,
        directory: Directory.Data
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get cache directory info
   */
  static async getCacheInfo(): Promise<{ path: string; size?: number }> {
    if (!this.isNativePlatform()) {
      return { path: '/models' };
    }

    try {
      const uri = await Filesystem.getUri({
        path: 'models',
        directory: Directory.Data
      });

      return { path: uri.uri };
    } catch (error) {
      console.error('Error getting cache info:', error);
      return { path: 'unknown' };
    }
  }
}

// Note: To use this in your app, you need to:
// 1. Install Capacitor filesystem plugin: npm install @capacitor/filesystem
// 2. Copy model files to assets folder during build
// 3. Configure capacitor.config.ts to include model files
