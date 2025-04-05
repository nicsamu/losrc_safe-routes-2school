define([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/core/reactiveUtils"
], function (WebMap, MapView, reactiveUtils) {
  console.log("✅ DOM ready. Starting map setup... (v4)");

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

  async function getLikeCount(objectid) {
    const doc = await summaryRef.get();
    return doc.exists && doc.data()[objectid] ? doc.data()[objectid] : 0;
  }

  async function incrementLike(objectid) {
    const userId = getUserId();
    const userRef = db.collection("likes_users").doc(userId);
    const userDoc = await userRef.get();
    const alreadyLiked = userDoc.exists && userDoc.data()?.[objectid];

    if (alreadyLiked) {
      alert("You've already liked this.");
      return null;
    }

    await userRef.set({ [objectid]: true }, { merge: true });
    await summaryRef.set({
      [objectid]: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });

    return await getLikeCount(objectid);
  }

  view.when(() => {
    console.log("🗺️ Map and view loaded.");

    reactiveUtils.watch(() => view.popup.visible, async (visible) => {
      console.log("👁 Popup visibility changed:", visible);
      if (!visible) return;

      const graphic = view.popup.selectedFeature;
      if (!graphic || !graphic.attributes?.objectid) {
        console.warn("⚠️ No objectid on selected feature.");
        return;
      }

      const objectid = graphic.attributes.objectid.toString();
      const count = await getLikeCount(objectid);
      console.log(`👍 Likes for objectid ${objectid}:`, count);

      view.popup.actions.removeAll();
      view.popup.actions.add({
        title: `${count} Likes`,
        id: "like-action",
        className: "esri-icon-thumbs-up"
      });
    });

    // ✅ Wait for view.popup.viewModel to be ready
    reactiveUtils.whenOnce(() => !!view.popup?.viewModel).then(() => {
      console.log("✅ Popup viewModel is ready, attaching trigger-action handler...");
      view.popup.viewModel.on("trigger-action", async (event) => {
        if (event.action.id !== "like-action") return;

        const graphic = view.popup.selectedFeature;
        if (!graphic?.attributes?.objectid) return;

        const objectid = graphic.attributes.objectid.toString();
        const updatedCount = await incrementLike(objectid);
        if (updatedCount !== null) {
          const likeAction = view.popup.actions.find(a => a.id === "like-action");
          if (likeAction) likeAction.title = `${updatedCount} Likes`;
          showLikeBurst();
        }
      });
    });
  });
});
