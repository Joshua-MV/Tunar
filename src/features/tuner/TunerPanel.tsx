import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import type { PressState } from '@/components/ui/pressState';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/** Small engraved panel screws in the four corners. */
export function Screws() {
  const { colors } = useTheme();
  const s = { position: 'absolute' as const, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border };
  return (
    <>
      <View pointerEvents="none" style={[s, { top: 9, left: 9 }]} />
      <View pointerEvents="none" style={[s, { top: 9, right: 9 }]} />
      <View pointerEvents="none" style={[s, { bottom: 9, left: 9 }]} />
      <View pointerEvents="none" style={[s, { bottom: 9, right: 9 }]} />
    </>
  );
}

/** Fourteen rising bars: the mic input level. */
export function LevelMeter({ db }: { db: number | null }) {
  const { colors } = useTheme();
  const lit = db === null ? 0 : Math.round(Math.max(0, Math.min(1, (db + 60) / 54)) * 14);
  return (
    <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 14 }} accessibilityLabel={db === null ? 'Microphone off' : `Input level ${Math.round(db)} decibels`}>
      {Array.from({ length: 14 }, (_, i) => (
        <View key={i} style={{ width: 4, height: 4 + i * 0.75, borderRadius: 1, backgroundColor: i < lit ? (i < 10 ? colors.success : colors.accent) : colors.divider }} />
      ))}
    </View>
  );
}

/**
 * The tuning meter, in plain words: a bar from "Too low" to "Too high" with the in-tune zone in
 * the middle, and a marker that slides to where the string is. Get the marker into the middle.
 */
export function TuneMeter({ cents, inTune, hearing, allDone }: { cents: number | null; inTune: boolean; hearing: boolean; allDone: boolean }) {
  const { colors } = useTheme();
  const c = hearing && cents !== null ? Math.max(-50, Math.min(50, cents)) : 0;
  const pos = useRef(new Animated.Value(50)).current;
  useEffect(() => {
    Animated.spring(pos, { toValue: c + 50, speed: 18, bounciness: 2, useNativeDriver: false }).start();
  }, [c, pos]);
  const low = hearing && !inTune && c < 0;
  const high = hearing && !inTune && c > 0;
  const good = allDone || (hearing && inTune);
  const markerCol = good ? colors.success : low ? colors.accent : high ? colors.danger : colors.borderStrong;
  const label = (text: string, on: boolean, col: string, align: 'left' | 'center' | 'right') => (
    <Text variant="caption" style={{ flex: 1, textAlign: align, fontSize: 12.5, color: on ? col : colors.textSubtle, fontFamily: on ? fonts.bodySemibold : fonts.body }}>
      {text}
    </Text>
  );
  return (
    <View style={{ gap: 10 }} accessibilityLabel={good ? 'In tune' : low ? 'Too low' : high ? 'Too high' : 'Waiting for a note'}>
      <View style={{ height: 34, justifyContent: 'center' }}>
        <View style={{ height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden', backgroundColor: colors.surfaceSunken }}>
          <View style={{ flex: 45, backgroundColor: low ? 'rgba(197,138,69,0.35)' : 'rgba(197,138,69,0.12)' }} />
          <View style={{ flex: 10, backgroundColor: good ? 'rgba(143,160,127,0.7)' : 'rgba(143,160,127,0.3)' }} />
          <View style={{ flex: 45, backgroundColor: high ? 'rgba(201,122,99,0.35)' : 'rgba(201,122,99,0.12)' }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: 4, bottom: 4, width: 2, marginLeft: -1, backgroundColor: colors.text, opacity: 0.5 }} />
        {(hearing || allDone) && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: pos.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
              width: 24,
              height: 24,
              marginLeft: -12,
              borderRadius: 12,
              backgroundColor: markerCol,
              borderWidth: 3,
              borderColor: colors.backgroundRaised,
              boxShadow: `0 0 0 4px ${good ? 'rgba(143,160,127,0.25)' : 'rgba(0,0,0,0)'}`,
            }}
          />
        )}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {label('◀  Too low', low, colors.highlight, 'left')}
        {label('In tune', good, colors.success, 'center')}
        {label('Too high  ▶', high, colors.danger, 'right')}
      </View>
    </View>
  );
}

/** How far off, in words a beginner can act on. */
export function howFar(cents: number): string {
  const a = Math.abs(cents);
  return a > 25 ? 'a lot' : a > 10 ? 'a little' : 'just a touch';
}

/** The mic button; it breathes while waiting so it's clear where to start. */
export function MicButton({ live, onPress, reduceMotion, busy }: { live: boolean; onPress: () => void; reduceMotion: boolean; busy: boolean }) {
  const { colors } = useTheme();
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (live || reduceMotion) {
      breathe.stopAnimation();
      breathe.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(breathe, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [live, reduceMotion, breathe]);
  return (
    <View style={{ width: 60, height: 60 }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 30,
          backgroundColor: colors.accent,
          opacity: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.45, 0, 0] }),
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.4, 1.4] }) }],
        }}
      />
      <MicFace live={live} onPress={onPress} busy={busy} />
    </View>
  );
}

function MicFace({ live, onPress, busy }: { live: boolean; onPress: () => void; busy: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={live ? 'Stop listening' : 'Start listening'}
      style={({ hovered }: PressState) => ({
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: live ? (hovered ? colors.surfaceHover : 'transparent') : hovered ? colors.accentPressed : colors.accent,
        borderWidth: live ? 1.5 : 0,
        borderColor: '#5A5952',
        opacity: busy ? 0.6 : 1,
      })}
    >
      {live ? <View style={{ width: 16, height: 16, borderRadius: 2, backgroundColor: colors.text }} /> : <Icon name="mic" size={24} color={colors.onAccent} />}
    </Pressable>
  );
}
