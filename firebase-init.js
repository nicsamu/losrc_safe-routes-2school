function waitForFirebaseInit() {
  if (typeof firebase !== "undefined" && firebase.initializeApp) {
    console.log("🔥 Firebase available, initializing...");

    const firebaseConfig = {
      apiKey: "AIzaSyCC5bxMbUrzFVXI0mVUBXL4STHuNxfWODo",
      authDomain: "school-route-safety-concerns.firebaseapp.com",
      projectId: "school-route-safety-concerns",
      storageBucket: "school-route-safety-concerns.appspot.com",
      messagingSenderId: "753357994973",
      appId: "1:753357994973:web:16d04af6a93e84dc465434",
      measurementId: "G-BE0BNEQ6HD"
    };

    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
  } else {
    console.log("⏳ Waiting for Firebase...");
    setTimeout(waitForFirebaseInit, 100);
  }
}

waitForFirebaseInit();
