import { replaceSrcs } from './index';
import { POST_FILE_THUMB_BG_SEL } from "./../vars/index";
/**
 * Post and image hover previews.
 */

import API from "../api";
import { View } from "../base";
import options from "../options";
import { getModel, page, posts } from "../state";
// import { sourcePath } from "./images"
import {
  ChangeEmitter, emitChanges,
  getClosestID, getID, hook, HOOKS,
} from "../util";
import {
  HOVER_CONTAINER_SEL, HOVER_TRIGGER_TIMEOUT_SECS,
  isMobile, POST_EMBED_SEL,
  POST_FILE_THUMB_SEL, POST_HOVER_TIMEOUT_SECS,
  POST_LINK_SEL, PRELOAD_MAX_SIZE, REQUEST_ANIMATION_FRAME, TRIGGER_MEDIA_HOVER_SEL,
} from "../vars";
import { Post } from "./model";
import * as popup from "./popup";
import PostView from "./view";
import { SmileReact } from "../common";
// import { SmileReact } from "../common";
// import { fileTypes } from "../common";

interface MouseMove extends ChangeEmitter {
  event: MouseEvent;
}
// Centralized mousemove target tracking.
const mouseMove = emitChanges<MouseMove>({
  event: {
    target: null,
  },
} as MouseMove);

let container = null as HTMLElement;
let lastTarget = null as EventTarget;
let delayedTID = 0;
let clearPostTID = 0;
const postPreviews = [] as PostPreview[];
let imagePreview = null as HTMLImageElement;

// Clone a post element as a preview.
// TODO(Kagami): Render mustache template instead?
function clonePost(el: HTMLElement): HTMLElement {
  const preview = el.cloneNode(true) as HTMLElement;
  // preview.setAttribute('')
  preview.removeAttribute("id");
  preview.classList.add("post_hover");
  preview.classList.add("visible");
  return preview;
}

// Post hover preview view.
class PostPreview extends View<Post> {
  public el: HTMLElement;
  public parent: HTMLElement;

  constructor(model: Post, parent: HTMLElement) {
    const { el } = model.view;
    super({ el: clonePost(el) });
    this.el.classList.remove('should-anim')
    this.parent = parent;
    this.model = Object.assign({}, model);
    this.render();
    parent.addEventListener("click", clearPostPreviews);
  }

  // Remove this view.
  public remove() {
    this.parent.removeEventListener("click", clearPostPreviews);
    super.remove();
  }

  private render() {
    // Underline reverse post links in preview.
    const re = new RegExp("[>\/]" + getClosestID(this.parent));
    for (const el of this.el.querySelectorAll(POST_LINK_SEL)) {
      if (re.test(el.textContent)) {
        el.classList.add("post-link_ref");
      }
    }
    container.append(this.el);
    this.position();
  }

  // Position the preview element relative to it's parent link.
  private position() {
    const height = this.el.offsetHeight;
    const rect = this.parent.getBoundingClientRect();
    const left = rect.left + window.pageXOffset;
    let top = rect.top + window.pageYOffset;

    // The preview will never take up more than 100% screen width, so no
    // need for checking horizontal overflow. Must be applied before
    // reading the height, so it takes into account post resizing to
    // viewport edge.
    this.el.style.left = left + "px";

    top -= height;
    // If post gets cut off at the top, put it bellow the link.
    if (top < window.pageYOffset) {
      top += height + 20;
    }
    this.el.style.top = top + "px";
  }
}

async function renderPostPreview(event: MouseEvent | TouchEvent) {
  const target = event.target as HTMLElement;
  if (!target.matches || !target.matches(POST_LINK_SEL)) {
    if (postPreviews.length && !clearPostTID) {
      if (!isMobile) {
        clearPostTID = window.setTimeout(
          clearInactivePostPreviews,
          POST_HOVER_TIMEOUT_SECS * 1000,
        );
      } else {
        clearInactivePostPreviews();
      }
    }
    return;
  }

  const id = getID(target);
  if (!id) return;
  // Don't duplicate.
  const len = postPreviews.length;
  if (len && postPreviews[len - 1].model.id === id) return;

  let post = posts.get(id);
  if (!post) {
    // Fetch from server, if this post is not currently displayed due to
    // lastN or in a different thread.
    const data = await API.post.get(id);

    post = new Post(data);
    const view = new PostView(post, null);
    await view.afterRender();
    post.seenOnce = true;
    posts.add(post);
    const { reacts = []} = data;
    reacts.forEach((react: SmileReact) => {
      view.setReaction(react);
    });
  }

  const preview = new PostPreview(post, target);
  postPreviews.push(preview);
  if (preview) replaceSrcs(preview.el);
}

function showImage(url: string, width: number, height: number, thumbSrc?: string,
                   fileType?: number, transparent?: boolean, postId?: number) {
  if (popup.isOpen(url)) return;
  let backgroundImage = "";
  switch (fileType) {
    case 0: // jpg
      backgroundImage = `url(${thumbSrc})`;
      break;
    case 1: // png
      backgroundImage = transparent ? "" : `url(${thumbSrc})`;
      break;
    default:
      break;
  }
  const rect = popup.getCenteredRect({ width, height });
  imagePreview = document.createElement("img");
  imagePreview.className = "media_hover";
  imagePreview.src = url;
  imagePreview.style.backgroundImage = backgroundImage;
  imagePreview.style.left = rect.left + "px";
  imagePreview.style.top = rect.top + "px";
  imagePreview.width = rect.width;
  imagePreview.height = rect.height;
  const startTime = new Date().getTime();
  imagePreview.onload = () => {
    const loadtime = new Date().getTime() - startTime;
    if (loadtime < 10000) {
      findPreloadImages((postId));
    }
  };
  imagePreview.onerror = () => {
    findPreloadImages(postId);
  };
  container.append(imagePreview);
}

export function findPreloadImages(postId: number): any {
  if (isMobile) return;
  let post;
  post = document.getElementById(`post${postId}`);
  if (!post) {
    post = document.querySelector(".hover-container").querySelector("article:last-of-type");
  }
  if (!post) return;
  const images = post.querySelectorAll(".trigger-media-hover:not(.post-embed)");
  preloadImages(images, images.length - 1);
}

let inProgress = false;
function preloadImages(images: any, i: number) {
  if (inProgress) return;
  if (i < 0) return;
  if (images[i].hasAttribute("preloaded")) {
    preloadImages(images, --i);
    return;
  }
  if (getModel(images[i] as HTMLImageElement).files[i].size > PRELOAD_MAX_SIZE) {
    preloadImages(images, --i);
    return;
  }
  const startTime = new Date().getTime();
  let preload = document.createElement("img");
  const postFileLink = images[i].closest(".post-file-link");
  preload.src = postFileLink ? postFileLink.href : "";
  inProgress = true;
  preload.onload = () => {
    images[i].setAttribute("preloaded", "");
    inProgress = false;
    const loadtime = new Date().getTime() - startTime;
    if (loadtime > 10000) return;
    preloadImages(images, --i);
    preload = null;
  };
  preload.onerror = () => {
    inProgress = false;
    preloadImages(images, --i);
    preload = null;
  };
}

function renderPostImagePreview(thumb: HTMLImageElement): any {
  if (options.workModeToggle) return;
  const post = getModel(thumb);
  const file = post.getFileByHash(thumb.dataset.sha1);
  const blurSrc = file.blur;
  const [width, height] = file.dims;
  const fileType = file.fileType;
  const transparent = file.transparent;
  showImage(file.src, width, height, blurSrc, fileType, transparent, post.id);

}

function renderPostEmbedPreview(link: HTMLElement): any {
  const thumbSrc = "";
  if (isMobile) return;
  const url = link.dataset.thumbnail_url;
  if (!url) return;
  const width = +link.dataset.thumbnail_width;
  const height = +link.dataset.thumbnail_height;
  showImage(url, width, height, thumbSrc);
}

function renderImagePreview(event: MouseEvent | TouchEvent) {
  if (isMobile) return;
  clearImagePreview();
  const { imageHover } = options;
  const target = event.target as HTMLElement;
  if (!target.matches) return;
  if (!target.matches(TRIGGER_MEDIA_HOVER_SEL) && !target.matches(POST_FILE_THUMB_BG_SEL)) return;
  if (target.matches(POST_FILE_THUMB_SEL) && imageHover) {
    renderPostImagePreview(target as HTMLImageElement);
  } else if (target.matches(POST_EMBED_SEL)) {
    renderPostEmbedPreview(target);
  } else if (target.matches(POST_FILE_THUMB_BG_SEL) && imageHover) {
    const target_ = target.parentElement.firstElementChild;
    if ((target_ as HTMLImageElement).matches(TRIGGER_MEDIA_HOVER_SEL)) renderPostImagePreview(target_ as HTMLImageElement);
  }
}

function clearInactivePostPreviews() {
  clearPostTID = 0;
  const target = mouseMove.event.target as HTMLElement;
  for (let i = postPreviews.length - 1; i >= 0; i--) {
    const preview = postPreviews[i];
    if (target === preview.parent || preview.el.contains(target)) {
      return;
    } else if (isMobile) {
      const curTar = target.classList;
      if (curTar.contains("popup-item") ||
        curTar.contains("popup-close-control") ||
        curTar.contains("fa") ||
        curTar.contains("popup-video-overlay") ||
        curTar.contains("reply-body-inner") ||
        curTar.contains("button") ||
        curTar.contains("reply-dragger")) return;
    }
    postPreviews.pop().remove();
  }
}

function clearPostPreviews() {
  while (postPreviews.length) {
    postPreviews.pop().remove();
  }
}

function clearImagePreview() {
  if (imagePreview) {
    imagePreview.remove();
    imagePreview = null;
  }
}

function delayedSetEvent(event: MouseEvent) {
  if (event.target !== mouseMove.event.target) {
    mouseMove.event = event;
  }
}

document.addEventListener("click", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (isMobile && target.classList.contains("post-link")) {
    e.preventDefault();
  }
}, false);

function onMouseMove(event: MouseEvent) {
  if (event.target !== lastTarget) {
    lastTarget = event.target;
    if (!isMobile || (isMobile && !REQUEST_ANIMATION_FRAME)) {
      clearTimeout(delayedTID);
      // Don't show previews when moving mouse across the page.
      delayedTID = window.setTimeout(() =>
        delayedSetEvent(event),
        HOVER_TRIGGER_TIMEOUT_SECS * 1000,
      );
    } else {
      if (requestAnimationFrame) {
        delayedTID = requestAnimationFrame(() =>
          delayedSetEvent(event));
      }
    }
  }
}

export function isOpen(): boolean {
  return !!imagePreview || !!postPreviews.length;
}

export function init() {
  container = document.querySelector(HOVER_CONTAINER_SEL);
  container.classList.add(page.thread ? "hover-container_thread" : "hover-container_board");
  document.addEventListener("mouseover", onMouseMove);

  mouseMove.onChange("event", renderPostPreview);
  mouseMove.onChange("event", renderImagePreview);
  hook(HOOKS.openPostPopup, clearImagePreview);
}
