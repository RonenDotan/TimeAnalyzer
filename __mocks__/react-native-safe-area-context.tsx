import React from 'react';

const insets = { top: 0, right: 0, bottom: 0, left: 0 };

export const SafeAreaProvider = ({ children }: { children: React.ReactNode }) =>
  <>{children}</>;

export const useSafeAreaInsets = () => insets;
