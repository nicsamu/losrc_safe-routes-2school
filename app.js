document.addEventListener("DOMContentLoaded", function () {
  // ✅ Initialize Firebase
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
  const db = firebase.firestore();

  function getUserId() {
    let uid = localStorage.getItem("srt_user_id");
    if (!uid) {
      uid = "user_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("srt_user_id", uid);
    }
    return uid;
  }

  require(["esri/Map", "esri/views/MapView", "esri/layers/FeatureLayer"], function(Map, MapView, FeatureLayer) {
    const concernLayer = new FeatureLayer({
      url: "https://services1.arcgis.com/dUkMSguHjSnNcU9J/arcgis/rest/services/School_Route_Safety_Concerns_(Public_View)/FeatureServer/0",
      outFields: ["*"],
      popupTemplate: {
        title: "Concern Location",
        content: `
          <p><strong>Likes:</strong> {likes}</p>
          <p>Click the 👍 Like button to support this location.</p>
        `
      },
      renderer: {
        type: "simple",
        symbol: {
          type: "simple-marker",
          color: "blue",
          size: 10,
          outline: {
            color: "white",
            width: 1
          }
        }
      }
    });

    const map = new Map({
      basemap: "streets-navigation-vector",
      layers: [concernLayer]
    });

    const view = new MapView({
      container: "viewDiv",
      map: map,
      zoom: 12,
      center: [-90.0715, 29.9511] // Adjust to your area
    });

    concernLayer.when(() => {
      concernLayer.queryExtent().then(function(response) {
        if (response.extent) {
          view.goTo(response.extent.expand(1.5));
        }
      });
    });

    const likeBtn = document.getElementById("likeBtn");
    let selectedFeature = null;

    view.whenLayerView(concernLayer).then(() => {
      view.on("click", async (event) => {
        const response = await view.hitTest(event);
        const result = response.results.find(r => r.graphic && r.graphic.layer === concernLayer);

        if (result) {
          selectedFeature = result.graphic;
          likeBtn.style.display = "inline-block";
        } else {
          selectedFeature = null;
          likeBtn.style.display = "none";
        }
      });
    });

    likeBtn.addEventListener("click", async () => {
      if (!selectedFeature) return;

      const objectId = selectedFeature.attributes.OBJECTID;
      const userId = getUserId();
      const likeDocRef = db.collection("likes").doc(userId);
      const doc = await likeDocRef.get();
      const alreadyLiked = doc.exists && doc.data()?.[`feature_${objectId}`];

      if (alreadyLiked) {
        alert("You already liked this.");
        return;
      }

      // Record like in Firebase
      await likeDocRef.set({ [`feature_${objectId}`]: true }, { merge: true });

      // Increment like count in ArcGIS
      const currentLikes = selectedFeature.attributes.likes || 0;
      const updatedFeature = {
        attributes: {
          OBJECTID: objectId,
          likes: currentLikes + 1
        }
      };

      concernLayer.applyEdits({ updateFeatures: [updatedFeature] }).then(() => {
        alert("Thanks for liking!");
        likeBtn.style.display = "none";
      }).catch(err => {
        console.error("Error applying edits:", err);
      });
    });
  });
});
