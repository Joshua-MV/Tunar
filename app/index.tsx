import Constants from 'expo-constants';

import { TunerScreen } from '@/features/tuner/TunerScreen';

export default function TunerHome() {
  return <TunerScreen standalone appName={Constants.expoConfig?.name ?? 'Tunar'} />;
}
