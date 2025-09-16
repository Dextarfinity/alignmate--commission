// Global types
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.gif';

// Extend the global type for Roboflow inference
declare global {
  interface Window {
    roboflow?: {
      createInference: (config: { 
        publishable_key: string;
        model: string; 
      }) => Promise<unknown>;
    };
  }
}

export {};