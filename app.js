document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM ready. Starting map setup... (v6)");

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
      return doc.exists && doc.data()?.[objectId] ? doc.data()[objectId] : 0;
    }

    async function hasUserLiked(objectId) {
      const userId = getUserId();
      const userDoc = await db.collection("likes_users").doc(userId).get();
      return userDoc.exists && userDoc.data()?.[objectId] === true;
    }

    async function toggleLike(objectId) {
      const userId = getUserId();
      const userRef = db.collection("likes_users").doc(userId);
      const userDoc = await userRef.get();
      const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId] === true;

      const updates = {};
      let increment = 0;

      if (alreadyLiked) {
        updates[objectId] = firebase.firestore.FieldValue.delete();
        increment = -1;
      } else {
        updates[objectId] = true;
        increment = 1;
      }

      await userRef.set(updates, { merge: true });
      await summaryRef.set({
        [objectId]: firebase.firestore.FieldValue.increment(increment)
      }, { merge: true });

      return {
        liked: !alreadyLiked,
        count: await getLikeCount(objectId)
      };
    }

    view.when(() => {
      console.log("🗺️ Map and view loaded.");
      window.view = view; // for debugging

      reactiveUtils.when(() => view.popup.viewModel, () => {
        console.log("🔁 Popup viewModel ready");

        reactiveUtils.watch(() => view.popup.visible, async (visible) => {
          if (!visible) return;

          const graphic = view.popup?.features?.[0];
          if (!graphic?.attributes?.objectid) return;

          const objectId = graphic.attributes.objectid.toString();
          const [count, liked] = await Promise.all([
            getLikeCount(objectId),
            hasUserLiked(objectId)
          ]);

          const likeIcon = liked ? "esri-icon-thumbs-up" : "esri-icon-thumbs-up";
          const classList = liked ? "liked" : "";

          view.popup.actions.removeAll();
          view.popup.actions.add({
            id: "like-action",
            className: `${likeIcon} ${classList}`,
            title: "" // hide label
          });

          view.popup.title += ` (${count} Likes)`;
        });

        reactiveUtils.on(() => view.popup.viewModel, "trigger-action", async (event) => {
          if (event.action.id !== "like-action") return;

          const graphic = view.popup?.features?.[0];
          if (!graphic?.attributes?.objectid) return;

          const objectId = graphic.attributes.objectid.toString();
          const { liked, count } = await toggleLike(objectId);

          const action = view.popup.actions.find(a => a.id === "like-action");
          if (action) {
            action.className = liked ? "esri-icon-thumbs-up liked" : "esri-icon-thumbs-up";
            action.title = ""; // hide label
          }

          // Live update title with count
          const originalTitle = graphic.layer?.popupTemplate?.title || "Feature";
          view.popup.title = `${originalTitle} (${count} Likes)`;

          if (liked) showLikeBurst();
        });
      });
    });
  });
});
