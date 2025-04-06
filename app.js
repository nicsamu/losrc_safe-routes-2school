document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting minimal map setup...");

  require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/core/reactiveUtils"
  ], function (WebMap, MapView, reactiveUtils) {
    const webmap = new WebMap({
      portalItem: { id: "b30daca1af104a7896a409f51e714e24" }
    });

    const view = new MapView({
      container: "viewDiv",
      map: webmap
    });

    const db = window.db;
    const summaryRef = db.collection("likes_summary").doc("counts");

    function getUserId() {
      let uid = localStorage.getItem("srt_user_id");
      if (!uid) {
        uid = "user_" + Math.random().toString(36).substring(2);
        localStorage.setItem("srt_user_id", uid);
      }
      return uid;
    }

    async function getLikeCount(objectId) {
      const doc = await summaryRef.get();
      return doc.exists && doc.data()[objectId] ? doc.data()[objectId] : 0;
    }

    async function incrementLike(objectId) {
      const userId = getUserId();
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId];

      if (alreadyLiked) {
        console.log("👍 Already liked.");
        return null;
      }

      await userRef.set({ [objectId]: true }, { merge: true });
      await summaryRef.set({
        [objectId]: firebase.firestore.FieldValue.increment(1)
      }, { merge: true });

      return await getLikeCount(objectId);
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded!");
      window.view = view;
      console.log("🌍 'view' is now globally available");

      // 🧪 Listen for popup visibility changes directly
      reactiveUtils.watch(() => view.popup.visible, async (visible) => {
        console.log("👁 Popup visibility changed:", visible);
        if (!visible) return;

        const graphic = view.popup.features?.[0];
        console.log("🔎 Selected feature:", graphic);
        console.log("📄 Attributes:", graphic?.attributes);

        const objectId = graphic?.attributes?.objectid;
        if (!objectId) {
          console.warn("⚠️ No valid objectid on feature.");
          return;
        }

        const count = await getLikeCount(objectId.toString());
        console.log(`👍 Like count for objectid ${objectId}: ${count}`);

        view.popup.actions.removeAll();
        view.popup.actions.add({
          title: `${count} Likes`,
          id: "like-action",
          className: "esri-icon-thumbs-up"
        });
      });

      // 🧪 Listen for button clicks
      view.popup.on("trigger-action", async (event) => {
        console.log("🎯 Trigger action:", event.action.id);

        if (event.action.id !== "like-action") return;

        const graphic = view.popup.features?.[0];
        const objectId = graphic?.attributes?.objectid;
        if (!objectId) return;

        const updatedCount = await incrementLike(objectId.toString());
        if (updatedCount !== null) {
          const likeAction = view.popup.actions.find(a => a.id === "like-action");
          if (likeAction) likeAction.title = `${updatedCount} Likes`;
        }
      });
    });
  });
});
