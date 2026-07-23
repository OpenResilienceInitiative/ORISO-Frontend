import 'react-app-polyfill/stable';
import 'fastestsmallesttextencoderdecoder';
import 'whatwg-fetch';
import 'core-js/features/promise';
import 'core-js/web/dom-collections';
import 'element-remove';
import 'element-scroll-polyfill';
import elementClosest from 'element-closest';

(
	globalThis as typeof globalThis & { TONE_SILENCE_LOGGING?: boolean }
).TONE_SILENCE_LOGGING = true;

elementClosest(window);
