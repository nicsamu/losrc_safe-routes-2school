define([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/core/reactiveUtils"
], function (WebMap, MapView, reactiveUtils) {
  console.log("✅ DOM ready. Starting map setup... (v3)");

  const webmap = new WebMap({
    portalItem: {
      id: "b30daca1af104a7896a409f51e714e24" // Your WebMap ID
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

  async function incrementLike(objectId) {
    const userId = getUserId();
    const userRef = db.collection("likes_users").doc(userId);
    const userDoc = await userRef.get();
    const alreadyLiked = userDoc.exists && userDoc.data()?.[objectId];

    if (alreadyLiked) {
      alert("You've already liked this.");
      return null;
    }

    await userRef.set({ [objectId]: true }, { merge: true });
    await summaryRef.set({
      [objectId]: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });

    return await getLikeCount(objectId);
  }

  view.when(() => {
    console.log("🗺️ Map and view loaded.");

    view.on("click", () => {
      setTimeout(async () => {
        const graphic = view.popup?.selectedFeature;
        if (!graphic || !graphic.attributes?.OBJECTID) {
          console.warn("⚠️ No OBJECTID on selected feature.");
          return;
        }

        const objectId = graphic.attributes.OBJECTID.toString();
        const count = await getLikeCount(objectId);
        console.log(`👍 Likes for OBJECTID ${objectId}:`, count);

        view.popup.actions.removeAll();
        view.popup.actions.add({
          title: `${count} Likes`,
          id: "like-action",
          className: "esri-icon-thumbs-up"
        });
      }, 500); // wait briefly for popup to open
    });

    view.popup.viewModel.on("trigger-action", async (event) => {
      if (event.action.id !== "like-action") return;

      const graphic = view.popup.selectedFeature;
      if (!graphic?.attributes?.OBJECTID) return;

      const objectId = graphic.attributes.OBJECTID.toString();
      const updatedCount = await incrementLike(objectId);
      if (updatedCount !== null) {
        const likeAction = view.popup.actions.find(a => a.id === "like-action");
        if (likeAction) likeAction.title = `${updatedCount} Likes`;
        showLikeBurst();
      }
    });
  });
});
