document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting minimal map setup...");

  require([
    "esri/WebMap",
    "esri/views/MapView",
    "esri/core/reactiveUtils"
  ], function (WebMap, MapView, reactiveUtils) {
    const webmap = new WebMap({
      portalItem: {
        id: "b30daca1af104a7896a409f51e714e24"
      }
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

    function showLikeBurst() {
      const burst = document.createElement("div");
      burst.className = "like-burst";
      burst.textContent = "+1";
      document.body.appendChild(burst);
      setTimeout(() => burst.style.top = "30%", 10);
      setTimeout(() => burst.style.opacity = "0", 500);
      setTimeout(() => burst.remove(), 1000);
    }

    async function getLikeCount(objectId) {
      const doc = await summaryRef.get();
      return doc.exists && doc.data()[objectId] ? doc.data()[objectId] : 0;
    }

    async function hasUserLiked(objectId) {
      const userId = getUserId();
      const userDoc = await db.collection("likes_users").doc(userId).get();
      return userDoc.exists && userDoc.data()?.[objectId];
    }

    async function toggleLike(objectId) {
      const userId = getUserId();
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId];

      if (alreadyLiked) {
        await userRef.set({ [objectId]: firebase.firestore.FieldValue.delete() }, { merge: true });
        await summaryRef.set({ [objectId]: firebase.firestore.FieldValue.increment(-1) }, { merge: true });
      } else {
        await userRef.set({ [objectId]: true }, { merge: true });
        await summaryRef.set({ [objectId]: firebase.firestore.FieldValue.increment(1) }, { merge: true });
        showLikeBurst();
      }

      return await getLikeCount(objectId);
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded.");
      window.view = view;

      reactiveUtils.when(() => view.popup.viewModel, () => {
        console.log("🔁 Popup viewModel ready");

        reactiveUtils.watch(() => view.popup.selectedFeature, async (graphic) => {
          if (!graphic || !graphic.attributes) {
            console.warn("⚠️ No feature selected or no attributes.");
            return;
          }

          const objectId = graphic.attributes.objectid ?? graphic.attributes.OBJECTID;
          if (!objectId) {
            console.warn("⚠️ No objectid on feature.");
            return;
          }

          const oidStr = objectId.toString();
          const count = await getLikeCount(oidStr);
          const liked = await hasUserLiked(oidStr);

          console.log(`👍 Like count for objectid ${oidStr}: ${count}, liked: ${liked}`);

          view.popup.actions.removeAll();
          view.popup.actions.add({
            id: "like-action",
            title: `${count}`,
            className: `esri-icon-thumbs-up ${liked ? "liked" : ""}`
          });
        });

        view.popup.viewModel.on("trigger-action", async (event) => {
          if (event.action.id !== "like-action") return;

          const graphic = view.popup.selectedFeature;
          if (!graphic?.attributes?.objectid) return;

          const oidStr = graphic.attributes.objectid.toString();
          const updatedCount = await toggleLike(oidStr);
          const likedNow = await hasUserLiked(oidStr);

          const likeAction = view.popup.actions.find(a => a.id === "like-action");
          if (likeAction) {
            likeAction.title = `${updatedCount}`;
            likeAction.className = `esri-icon-thumbs-up ${likedNow ? "liked" : ""}`;
          }
        });
      });
    });
  });
});
