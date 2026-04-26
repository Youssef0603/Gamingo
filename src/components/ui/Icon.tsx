import React from 'react';

import { Ionicons } from '@react-native-vector-icons/ionicons/static';

export type IconName =
  | 'checkmark-circle'
  | 'chevron-down'
  | 'game-controller'
  | 'game-controller-outline'
  | 'heart'
  | 'heart-outline'
  | 'search'
  | 'volume-high';

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
};

function Icon({ name, size = 22, color }: IconProps) {
  return <Ionicons color={color} name={name} size={size} />;
}

export default Icon;
