/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { enableScreens } from 'react-native-screens';
import App from './App';
import { name as appName } from './app.json';
import { initializeFirebaseServices } from './src/services/firebase';

enableScreens();
initializeFirebaseServices().catch(() => undefined);

AppRegistry.registerComponent(appName, () => App);
