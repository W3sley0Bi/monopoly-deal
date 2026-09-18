import React from 'react';
import { View, Pressable } from 'react-native';

export function Test() {
  return (
    <>
      {/* @ts-expect-error */}
      <Pressable title="Pressable Tooltip" />
      {/* @ts-expect-error */}
      <View title="View Tooltip" />
    </>
  );
}
