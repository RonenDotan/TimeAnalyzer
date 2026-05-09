import React from 'react';
import { View } from 'react-native';

export type DateTimePickerEvent = {
  type: 'set' | 'dismissed' | 'neutralButtonPressed';
};

export default function DateTimePicker() {
  return <View testID="datetime-picker" />;
}
