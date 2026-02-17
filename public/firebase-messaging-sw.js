/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBpvEtqSV1o6MwD7I2cMHqcgjR80GlI7v0",
  authDomain: "pl-play-match.firebaseapp.com",
  projectId: "pl-play-match",
  storageBucket: "pl-play-match.firebasestorage.app",
  messagingSenderId: "307991939935",
  appId: "1:307991939935:web:0643882109a741a6f384ea",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
    });
  }
});
