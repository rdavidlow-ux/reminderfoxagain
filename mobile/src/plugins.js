// The Capacitor plugins, bundled by build-web.js into www/m/cap.js (window.RFCap). In the app they call the native
// code; in a desktop browser (the UI checks) they fall back to their web versions (files in IndexedDB).
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';

window.RFCap = { Capacitor, Filesystem, Directory, Encoding, LocalNotifications, App, Share, Browser };
