import { Platform, type PressableStateCallbackType, type ViewStyle } from 'react-native';

/** react-native-web adds `hovered` to the Pressable state; native never sets it. */
export type PressState = PressableStateCallbackType & { hovered?: boolean };

/**
 * Hover and press changes (colour, border, lift) ease in over 160 ms instead of snapping.
 * Web only (the Windows app); on Android there is no hover.
 */
export const smooth: ViewStyle =
  Platform.OS === 'web'
    ? ({
        transitionProperty: 'background-color, border-color, transform, opacity, box-shadow',
        transitionDuration: '160ms',
        transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      } as unknown as ViewStyle)
    : {};
