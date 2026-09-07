/* =========================================================
   event.js
   ---------------------------------------------------------
   ・個別イベントの「独立した詳細ページ」を描画するスクリプト
   ・URL末尾の ?id=xxxx（または #xxxx）からイベントIDを取得し、
     events.json から該当イベントを1件だけ探して表示します
       例) event.html?id=evt2026001
   ・events.json の "detail" 列はHTMLとしてそのまま描画します
     （index.html のモーダルと同じ挙動。信頼できるHTMLのみ入力）
   ・お気に入り（localStorage）は一覧ページと共有します
   ========================================================= */
(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var FAVORITES_STORAGE_KEY = "machiEventDrop.favorites";

  var els = {
    siteName: document.getElementById("siteName"),
    siteNameSub: document.getElementById("siteNameSub"),
    siteFooter: document.getElementById("siteFooter"),
    searchForm: document.getElementById("searchForm"),
    searchInput: document.getElementById("searchInput"),
    statusMessage: document.getElementById("statusMessage"),
    backLabel: document.getElementById("backLabel"),
    root: document.getElementById("detailRoot"),
    thumb: document.getElementById("detailThumb"),
    category: document.getElementById("detailCategory"),
    title: document.getElementById("detailTitle"),
    address: document.getElementById("detailAddress"),
    body: document.getElementById("detailBody"),
    link: document.getElementById("detailLink"),
    fav: document.getElementById("detailFav"),
    share: document.getElementById("detailShare"),
    shareLabel: document.getElementById("shareLabel"),
    canonical: document.getElementById("canonicalLink"),
    ogTitle: document.getElementById("ogTitle"),
    ogDesc: document.getElementById("ogDesc"),
    ogImage: document.getElementById("ogImage"),
  };

  var favorites = loadFavorites();

  // ---------- 共通ユーティリティ（main.js と同等） ----------
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }
  function stripHtml(html) {
    var div = document.createElement("div");
    div.innerHTML = html || "";
    return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
  }
  function loadFavorites() {
    try {
      var raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) { return new Set(); }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites))); } catch (e) {}
  }

  var autoColorCache = {};
  function getCategoryColor(category) {
    if (cfg.categoryColorMap && cfg.categoryColorMap[category]) return cfg.categoryColorMap[category];
    if (autoColorCache[category]) return autoColorCache[category];
    var palette = (cfg.categoryColorPalette && cfg.categoryColorPalette.length)
      ? cfg.categoryColorPalette : ["#5b7fd6", "#3f9d6b", "#d9822b"];
    var hash = 0;
    for (var i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
    var color = palette[hash % palette.length];
    autoColorCache[category] = color;
    return color;
  }
  function buildThumb(event, wrapEl) {
    function appendPlaceholder() {
      var p = document.createElement("div");
      p.className = "thumb-placeholder";
      p.textContent = event.category ? event.category : (cfg.thumbnailFallbackText || "NO IMAGE");
      wrapEl.appendChild(p);
    }
    if (event.thumbnail) {
      var base = cfg.thumbnailBasePath || "";
      var img = document.createElement("img");
      img.src = base + event.thumbnail;
      img.alt = event.title || "";
      img.addEventListener("error", function () { img.remove(); appendPlaceholder(); }, { once: true });
      wrapEl.appendChild(img);
    } else {
      appendPlaceholder();
    }
  }
  function pinIcon() {
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="vertical-align:-2px">' +
      '<path d="M12 2C7.6 2 4 5.6 4 10c0 5.4 7 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8z" fill="currentColor"/>' +
      '<circle cx="12" cy="10" r="3" fill="#fff"/></svg>';
  }
  function externalIcon(c) {
    c = c || "currentColor";
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none">' +
      '<path d="M14 3h7v7" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M21 3l-9 9" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M19 14v5a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function heartIcon(filled) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none">' +
      '<path d="M12 20.5s-7.6-4.6-10-9.3C.5 7.8 2.4 4.5 6 4.5c2 0 3.6 1.1 4.5 2.4C11.4 5.6 13 4.5 15 4.5c3.6 0 5.5 3.3 4 6.7-2.4 4.7-10 9.3-10 9.3z" ' +
      (filled ? 'fill="currentColor"' : 'stroke="currentColor" stroke-width="1.8"') + '/></svg>';
  }

  // ---------- 共通設定を反映 ----------
  function applyTextConfig() {
    if (cfg.siteName && els.siteName) els.siteName.textContent = cfg.siteName;
    if (cfg.siteNameSub && els.siteNameSub) els.siteNameSub.textContent = cfg.siteNameSub;
    if (cfg.footerHtml && els.siteFooter) els.siteFooter.innerHTML = cfg.footerHtml;
    if (cfg.searchPlaceholder && els.searchInput) {
      els.searchInput.placeholder = cfg.searchPlaceholder;
      els.searchInput.setAttribute("aria-label", cfg.searchPlaceholder);
    }
  }

  // 検索ボックスから入力したら、一覧ページへ q 付きで遷移
  if (els.searchForm) {
    els.searchForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var kw = (els.searchInput.value || "").trim();
      location.href = "./" + (kw ? "?q=" + encodeURIComponent(kw) : "");
    });
  }

  function showStatus(text) {
    els.statusMessage.hidden = false;
    els.statusMessage.textContent = text;
    els.root.hidden = true;
  }

  // ---------- URLからイベントIDを取得 ----------
  function getEventId() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    if (id) return id.trim();
    // フォールバック：#evt2026001 形式にも対応
    if (location.hash) return decodeURIComponent(location.hash.replace(/^#/, "")).trim();
    return "";
  }

  // ---------- 描画 ----------
  function renderEvent(event) {
    els.root.hidden = false;
    els.statusMessage.hidden = true;

    var color = getCategoryColor(event.category || "");

    // サムネイル
    els.thumb.innerHTML = "";
    buildThumb(event, els.thumb);

    // カテゴリ
    if (event.category) {
      els.category.hidden = false;
      els.category.textContent = event.category;
      els.category.style.color = color;
    } else {
      els.category.hidden = true;
    }

    // タイトル
    els.title.textContent = event.title || "(タイトル未設定)";

    // 住所
    if (event.address) {
      els.address.hidden = false;
      els.address.innerHTML = '<span class="pin" aria-hidden="true">' + pinIcon() + '</span><span>' +
        escapeHtml(event.address) + '</span>';
    } else {
      els.address.hidden = true;
    }

    // 本文（detail は HTML として描画）
    els.body.innerHTML = (event.detail && String(event.detail).trim())
      ? event.detail
      : "<p>" + escapeHtml(cfg.detailFallbackText || "詳細情報は準備中です。") + "</p>";

    // 公式サイトリンク
    if (event.url) {
      els.link.hidden = false;
      els.link.href = event.url;
      els.link.innerHTML = escapeHtml(cfg.officialSiteLabel || "公式サイトを見る") + externalIcon("#fff");
    } else {
      els.link.hidden = true;
    }

    // お気に入りボタン
    updateFavButton(event.id);
    els.fav.addEventListener("click", function () {
      if (favorites.has(event.id)) favorites.delete(event.id); else favorites.add(event.id);
      saveFavorites();
      updateFavButton(event.id);
    });

    // 共有ボタン
    setupShare(event);

    // <title> / meta / canonical / OGP を更新（SEO・シェア用）
    var plain = stripHtml(event.detail).slice(0, 110);
    document.title = (event.title || "イベント詳細") + "｜" + (cfg.siteName || "");
    setMeta("description", plain);
    if (els.canonical) els.canonical.setAttribute("href", canonicalUrl(event.id));
    if (els.ogTitle) els.ogTitle.setAttribute("content", event.title || "");
    if (els.ogDesc) els.ogDesc.setAttribute("content", plain);
    if (els.ogImage && event.thumbnail) {
      els.ogImage.setAttribute("content", (cfg.thumbnailBasePath || "") + event.thumbnail);
    }
  }

  function updateFavButton(id) {
    var isFav = favorites.has(id);
    els.fav.classList.toggle("active", isFav);
    els.fav.setAttribute("aria-pressed", String(isFav));
    els.fav.innerHTML = heartIcon(isFav) + '<span>' +
      escapeHtml(isFav ? (cfg.favoriteRemoveLabel || "お気に入りから削除")
                       : (cfg.favoriteAddLabel || "お気に入りに追加")) + '</span>';
  }

  function setupShare(event) {
    if (els.shareLabel && cfg.shareLabel) els.shareLabel.textContent = cfg.shareLabel;
    els.share.addEventListener("click", function () {
      var url = location.href;
      if (navigator.share) {
        navigator.share({ title: event.title || document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          var orig = els.shareLabel ? els.shareLabel.textContent : "";
          if (els.shareLabel) els.shareLabel.textContent = cfg.shareCopiedLabel || "URLをコピーしました";
          setTimeout(function () { if (els.shareLabel) els.shareLabel.textContent = orig; }, 1800);
        });
      }
    });
  }

  function canonicalUrl(id) {
    return location.origin + location.pathname + "?id=" + encodeURIComponent(id);
  }
  function setMeta(name, content) {
    var m = document.querySelector('meta[name="' + name + '"]');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", name); document.head.appendChild(m); }
    m.setAttribute("content", content);
  }

  // ---------- データ取得 ----------
  function loadEvent() {
    var id = getEventId();
    if (!id) {
      showStatus("イベントが指定されていません。一覧ページからイベントをお選びください。");
      return;
    }
    var src = cfg.dataSource || "events.json";
    fetch(src, { cache: "no-store" })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then(function (json) {
        if (!Array.isArray(json)) throw new Error("JSON形式が不正です");
        var event = json.find(function (e) { return e && e.id === id; });
        if (!event) {
          showStatus("指定されたイベント（" + id + "）は見つかりませんでした。削除されたか、URLが正しくない可能性があります。");
          return;
        }
        renderEvent(event);
      })
      .catch(function (err) {
        console.error("イベントデータの読み込みに失敗しました:", err);
        showStatus(cfg.loadErrorText || "イベント情報の読み込みに失敗しました。時間をおいて再度お試しください。");
      });
  }

  // ---------- 初期化 ----------
  applyTextConfig();
  if (els.backLabel && cfg.backToListLabel) els.backLabel.textContent = cfg.backToListLabel;
  loadEvent();

  // ヘッダーのスクロール制御（一覧ページと共通挙動）
  var hdr = document.getElementById("hdr");
  if (hdr) window.addEventListener("scroll", function () { hdr.classList.toggle("scrolled", window.scrollY > 20); });
})();
