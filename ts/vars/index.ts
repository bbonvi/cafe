/**
 * Shared constants, should be used everywhere.
 */
// Don't import here anything!

// Selectors, must be kept in sync with markup and styles!
export const MAIN_CONTAINER_SEL = ".main";
export const ALERTS_CONTAINER_SEL = ".alerts-container";
export const HOVER_CONTAINER_SEL = ".hover-container";
export const REACTION_HOVER_CONTAINER_SEL = ".reaction-container";
export const POPUP_CONTAINER_SEL = ".popup-container";
export const MODAL_CONTAINER_SEL = ".modal-container";
export const REPLY_CONTAINER_SEL = ".reply-container";
export const PROFILES_CONTAINER_SEL = ".header-profiles";
export const BOARD_SEARCH_INPUT_SEL = ".board-search-input";
export const BOARD_SEARCH_SORT_SEL = ".board-search-sort";
export const THREAD_SEL = ".thread";
export const POST_SEL = ".post";
export const POST_LINK_SEL = ".post-link";
export const POST_BODY_SEL = ".post-body";
export const POST_FILE_TITLE_SEL = ".post-file-title-badge";
export const POST_FILE_LINK_SEL = ".post-file-link";
export const POST_FILE_THUMB_SEL = ".post-file-thumb";
export const POST_FILE_THUMB_CONT_SEL = ".post-file-thumb_containter";
export const POST_FILE_THUMB_BG_SEL = ".post-file-thumb_background";
export const POST_BACKLINKS_SEL = ".post-backlinks";
export const POST_EMBED_SEL = ".post-embed";
export const POST_EMBED_INSTAGRAM_SEL = ".post-instagram-embed";
export const POST_EMBED_TWITTER_SEL = ".post-twitter-embed";
export const PAGE_NAV_TOP_SEL = ".page-nav-top";
export const PAGE_NAV_BOTTOM_SEL = ".page-nav-bottom";

export const COLOR_PICKER_SEL = ".color-picker";
export const PLAYER_VOLUME_SEL = ".player-volume";
export const COLOR_SELECTOR_SEL = ".color-selector";
export const COLOR_PICKER_CURSOR = ".color-picker_cursor";
export const COLOR_PICKER_H_CURSOR = ".color-picker_cursor_hue";
export const COLOR_PICKER_S_CURSOR = ".color-picker_cursor_saturation";
export const COLOR_PICKER_B_CURSOR = ".color-picker_cursor_brightness";

// Action trigger selectors, might appear multiple times in markup.
export const TRIGGER_OPEN_REPLY_SEL = ".trigger-open-reply";
export const TRIGGER_QUOTE_POST_SEL = ".trigger-quote-post";
export const TRIGGER_REACT_SEL = ".trigger-react-post";
export const TRIGGER_REACT_ADD_SEL = ".trigger-react-post-add";
export const TRIGGER_DELETE_POST_SEL = ".trigger-delete-post";
export const TRIGGER_BAN_BY_POST_SEL = ".trigger-ban-by-post";
export const TRIGGER_IGNORE_USER_SEL = ".trigger-ignore-user";
export const TRIGGER_MEDIA_HOVER_SEL = ".trigger-media-hover";
export const TRIGGER_MEDIA_POPUP_SEL = ".trigger-media-popup";
export const TRIGGER_PAGE_NAV_TOP_SEL = ".trigger-page-nav-top";
export const TRIGGER_PAGE_NAV_BOTTOM_SEL = ".trigger-page-nav-bottom";

// Constants.
export const ALERT_HIDE_TIMEOUT_SECS = 4;
export const CONTRAST_RATIO = 1.55;
export const RELATIVE_TIME_PERIOD_SECS = 60;
export const HOVER_TRIGGER_TIMEOUT_SECS = 0.1;
export const PREVIEW_TRIGGER_TIMEOUT_SECS = 0.2;
export const POST_HOVER_TIMEOUT_SECS = 0.5;
export const ZOOM_STEP_PX = 160;
export const HEADER_HEIGHT_PX = 40;
export const REPLY_THREAD_WIDTH_PX = 700;
export const REPLY_BOARD_WIDTH_PX = 1000;
export const REPLY_HEIGHT_PX = 250;
export const DEFAULT_NOTIFICATION_IMAGE_URL = "/static/img/notification.png";
const DAY_MS = 24 * 60 * 60 * 1000;
export const EMBED_CACHE_EXPIRY_MS = 30 * DAY_MS;
export const PRELOAD_MAX_SIZE = 3.5 * 1000000;

export const MIN_SIZE_TO_COMPRESS_PNG = 2
export const CLIENT_IMAGE_COMPRESSION_QUALITY = 0.93

export const REQUEST_ANIMATION_FRAME =
    window.requestAnimationFrame || window.webkitRequestAnimationFrame;
export const isMobile =
    window.matchMedia("(hover: none)").matches ||
    /android|ipad|iphone|mobi/i.test(navigator.userAgent) ||
    "ontouchstart" in document.documentElement;
export const isTablet = isMobile && window.innerWidth >= 768;
export const isFirefox = /firefox/i.test(navigator.userAgent);
export const isLinux = /X11/i.test(navigator.appVersion);
export const isWebkit = "webkitLineBreak" in document.documentElement.style;
export const isEdge = window.navigator.userAgent.indexOf("Edge") > -1;

export function FULLSCREEN_CHANGE_SUPPORT(): number {
    if ("onfullscreenchange" in document) {
        return 1;
    } else if ("onwebkitfullscreenchange" in document) {
        return 2;
    } else if ("onmozfullscreenchange" in document) {
        return 3;
    } else if ("onmsfullscreenchange" in document) {
        return 4;
    } else {
        return 5;
    }
}
